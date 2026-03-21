import { Octokit } from 'octokit';

export interface GitHubConfig {
  accessToken: string;
}

let octokit: Octokit | null = null;

export const getGitHubClient = (token?: string) => {
  if (token) {
    octokit = new Octokit({ auth: token });
  }
  return octokit;
};

export const fetchUserProfile = async (token: string) => {
  const client = new Octokit({ auth: token });
  const { data } = await client.rest.users.getAuthenticated();
  return data;
};

export const fetchUserRepos = async (token: string) => {
  const client = new Octokit({ auth: token });
  const { data } = await client.rest.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 100,
  });
  return data;
};

export const fetchRepoContents = async (token: string, owner: string, repo: string, path: string = '') => {
  const client = new Octokit({ auth: token });
  const { data } = await client.rest.repos.getContent({
    owner,
    repo,
    path,
  });
  return data;
};

const getLanguageFromPath = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return 'typescript';
    case 'js': case 'jsx': return 'javascript';
    case 'css': return 'css';
    case 'html': return 'html';
    case 'json': return 'json';
    case 'md': return 'markdown';
    default: return 'plaintext';
  }
};

export const cloneRepository = async (token: string, owner: string, repo: string) => {
  const client = new Octokit({ auth: token });
  
  const { data: repoData } = await client.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  const { data: treeData } = await client.rest.git.getTree({
    owner,
    repo,
    tree_sha: defaultBranch,
    recursive: "true"
  });

  const files = [];
  const blobs = treeData.tree.filter(item => item.type === 'blob');
  
  // Limit to 50 files to avoid hitting GitHub API rate limits during clone
  const blobsToFetch = blobs.slice(0, 50); 
  
  for (const blob of blobsToFetch) {
    if (!blob.path || !blob.sha) continue;
    
    const { data: blobData } = await client.rest.git.getBlob({
      owner,
      repo,
      file_sha: blob.sha
    });
    
    // GitHub API returns base64 encoded content for blobs
    // We need to decode it properly, handling utf-8 characters
    const base64Content = blobData.content.replace(/\n/g, '');
    const content = decodeURIComponent(escape(atob(base64Content)));
    
    files.push({
      id: blob.path,
      name: blob.path.split('/').pop() || blob.path,
      content,
      language: getLanguageFromPath(blob.path)
    });
  }
  
  return files;
};

export const pushProjectToGitHub = async (token: string, repoName: string, files: any[], onProgress?: (msg: string) => void) => {
  const client = new Octokit({ auth: token });
  
  onProgress?.('Mengautentikasi profil GitHub...');
  const { data: user } = await client.rest.users.getAuthenticated();
  const owner = user.login;

  onProgress?.(`Memeriksa repositori ${owner}/${repoName}...`);
  let repoExists = true;
  let defaultBranch = 'main';
  try {
    const { data: repo } = await client.rest.repos.get({ owner, repo: repoName });
    defaultBranch = repo.default_branch;
  } catch (err: any) {
    if (err.status === 404) {
      repoExists = false;
    } else {
      throw err;
    }
  }

  if (!repoExists) {
    onProgress?.(`Membuat repositori baru (Private): ${repoName}...`);
    await client.rest.repos.createForAuthenticatedUser({
      name: repoName,
      private: true,
      auto_init: true,
    });
    // Beri waktu API GitHub untuk inisialisasi awal
    await new Promise(resolve => setTimeout(resolve, 2500));
  }

  onProgress?.('Mengambil referensi branch...');
  const { data: ref } = await client.rest.git.getRef({
    owner,
    repo: repoName,
    ref: `heads/${defaultBranch}`,
  });
  const commitSha = ref.object.sha;

  const { data: commit } = await client.rest.git.getCommit({
    owner,
    repo: repoName,
    commit_sha: commitSha,
  });
  const baseTreeSha = commit.tree.sha;

  onProgress?.(`Merakit ${files.length} file ke memori Cloud...`);
  const treeItems: any[] = [];
  
  for (const file of files) {
    // Pada IDE Aura, file hasil clone menggunakan ID untuk path relatif, namun file baru menggunakan Nama untuk random.
    const path = file.id && file.id.includes('/') ? file.id : file.name;
    
    // Convert string base64 / content safely for GitHub API
    const { data: blob } = await client.rest.git.createBlob({
      owner,
      repo: repoName,
      content: file.content || '',
      encoding: 'utf-8',
    });

    treeItems.push({
      path: path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }

  onProgress?.('Membangun Git Tree structure...');
  const { data: newTree } = await client.rest.git.createTree({
    owner,
    repo: repoName,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  onProgress?.('Membuat rilis komit baru...');
  const { data: newCommit } = await client.rest.git.createCommit({
    owner,
    repo: repoName,
    message: 'chore: Aura IDE Cloud Sync Push',
    tree: newTree.sha,
    parents: [commitSha],
  });

  onProgress?.('Mem-push komit ke branch utama...');
  await client.rest.git.updateRef({
    owner,
    repo: repoName,
    ref: `heads/${defaultBranch}`,
    sha: newCommit.sha,
  });

  onProgress?.('✨ Cloud Push berhasil!');
  return true;
};
