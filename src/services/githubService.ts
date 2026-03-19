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
