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
    per_page: 10,
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
