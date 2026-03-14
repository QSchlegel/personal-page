import { unstable_cache } from "next/cache";

import { fetchGitHubRepos } from "@/lib/github";
import type { GitHubStatsResponse } from "@/lib/types";

const GITHUB_STATS_USERNAME = "QSchlegel";
const FEATURED_REPO_TARGET = 8;
const GITHUB_STATS_CACHE_KEY = "github-stats-qschlegel-v1";
const GITHUB_STATS_CACHE_TTL_SECONDS = 60 * 60 * 24;

function buildSeedFallbackStats(): GitHubStatsResponse {
  return {
    username: GITHUB_STATS_USERNAME,
    repoCount: 0,
    totalStars: 0,
    featuredCount: FEATURED_REPO_TARGET,
    latestPushAt: null,
    fetchedAt: new Date().toISOString(),
    source: "seed-fallback",
    cacheTtlSeconds: GITHUB_STATS_CACHE_TTL_SECONDS,
  };
}

const getCachedGitHubStats = unstable_cache(
  async (): Promise<GitHubStatsResponse> => {
    try {
      const repos = await fetchGitHubRepos(GITHUB_STATS_USERNAME);
      const ownRepos = repos.filter((repo) => !repo.fork);
      const repoCount = ownRepos.length;
      const totalStars = ownRepos.reduce((total, repo) => total + repo.stargazers_count, 0);

      const latestPushAt =
        ownRepos.reduce<string | null>((latest, repo) => {
          if (!repo.pushed_at) {
            return latest;
          }

          if (!latest) {
            return repo.pushed_at;
          }

          return +new Date(repo.pushed_at) > +new Date(latest) ? repo.pushed_at : latest;
        }, null) ?? null;

      return {
        username: GITHUB_STATS_USERNAME,
        repoCount,
        totalStars,
        featuredCount: FEATURED_REPO_TARGET,
        latestPushAt,
        fetchedAt: new Date().toISOString(),
        source: "github-live",
        cacheTtlSeconds: GITHUB_STATS_CACHE_TTL_SECONDS,
      };
    } catch (error) {
      console.warn("GitHub stats fetch failed, returning seed fallback", error);
      return buildSeedFallbackStats();
    }
  },
  [GITHUB_STATS_CACHE_KEY],
  {
    revalidate: GITHUB_STATS_CACHE_TTL_SECONDS,
  },
);

export async function getGitHubStats(): Promise<GitHubStatsResponse> {
  return getCachedGitHubStats();
}
