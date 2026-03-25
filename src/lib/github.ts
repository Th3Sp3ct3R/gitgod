export interface GitHubRepoRef {
  owner: string;
  repo: string;
}

export function parseGitHubUrl(url: string): GitHubRepoRef | null {
  const match = url.match(/github\.com\/([^\/\s#?]+)\/([^\/\s#?]+)/);
  if (!match) return null;
  const repo = match[2].replace(/\.git$/, "");
  return { owner: match[1], repo };
}
