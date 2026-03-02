import { env } from "@/lib/env";

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  homepage: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  stargazers_count: number;
  fork: boolean;
}

export async function fetchGitHubRepos(user: string): Promise<GitHubRepo[]> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "qs-portfolio-sync",
  };

  if (env.GITHUB_API_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_API_TOKEN}`;
  }

  const url = new URL(`https://api.github.com/users/${user}/repos`);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("type", "owner");
  url.searchParams.set("sort", "updated");

  const response = await fetch(url, {
    headers,
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub API failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as GitHubRepo[];
  return payload.filter((repo) => repo && typeof repo.name === "string");
}
