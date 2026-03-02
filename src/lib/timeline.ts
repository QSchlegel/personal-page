import { Prisma } from "@prisma/client";

import { env } from "@/lib/env";
import { fetchGitHubRepos } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import type { TimelineProject, TimelineResponse } from "@/lib/types";

const curatedSeed: Array<{
  repoName: string;
  featuredOrder: number;
  label: string;
  summary: string;
  iframeUrl?: string;
}> = [
  {
    repoName: "TripWire",
    featuredOrder: 1,
    label: "Monitoring",
    summary: "A sensible request monitor with pragmatic operational focus.",
  },
  {
    repoName: "hive-mind",
    featuredOrder: 2,
    label: "Multi-Agent Systems",
    summary: "Coordination-first architecture for agent collaboration.",
  },
  {
    repoName: "OrchWiz",
    featuredOrder: 3,
    label: "Orchestration",
    summary: "A workflow-heavy TypeScript orchestration platform.",
  },
  {
    repoName: "wallet-enclave",
    featuredOrder: 4,
    label: "Security",
    summary: "A secure wallet enclave experiment focused on safe boundaries.",
  },
  {
    repoName: "envy-",
    featuredOrder: 5,
    label: "DX Utility",
    summary: "A lightweight utility and SPA for sharing env vars and secrets casually.",
  },
  {
    repoName: "mine-dine",
    featuredOrder: 6,
    label: "Product",
    summary: "An end-to-end product exploration in TypeScript.",
  },
  {
    repoName: "mesh-mcp",
    featuredOrder: 7,
    label: "MCP",
    summary: "Model Context Protocol surface for Mesh workflows.",
    iframeUrl: "https://mesh-mcp.vercel.app",
  },
  {
    repoName: "blockfrost-mcp",
    featuredOrder: 8,
    label: "MCP",
    summary: "Blockfrost integrations via MCP with practical developer ergonomics.",
    iframeUrl: "https://blockfrost-mcp.vercel.app",
  },
  {
    repoName: "script-explorer",
    featuredOrder: 999,
    label: "Tooling",
    summary: "Interactive script browsing and exploration tooling.",
    iframeUrl: "https://www.script-explorer.com",
  },
];

const curatedMap = new Map(curatedSeed.map((entry) => [entry.repoName, entry]));

function toTimelineProject(input: {
  repoName: string;
  fullName: string;
  description: string | null;
  language: string | null;
  homepage: string | null;
  htmlUrl: string;
  createdAtGithub: Date;
  updatedAtGithub: Date;
  pushedAtGithub: Date | null;
  stars: number;
  label: string | null;
  summary: string | null;
  iframeUrl: string | null;
  isFeatured: boolean;
  featuredOrder: number | null;
}): TimelineProject {
  return {
    repoName: input.repoName,
    fullName: input.fullName,
    description: input.description,
    language: input.language,
    homepage: input.homepage,
    htmlUrl: input.htmlUrl,
    createdAt: input.createdAtGithub.toISOString(),
    updatedAt: input.updatedAtGithub.toISOString(),
    pushedAt: input.pushedAtGithub?.toISOString() ?? null,
    stars: input.stars,
    label: input.label,
    summary: input.summary,
    iframeUrl: input.iframeUrl,
    isFeatured: input.isFeatured,
    featuredOrder: input.featuredOrder,
  };
}

export async function seedProjectOverrides(): Promise<void> {
  await Promise.all(
    curatedSeed.map((seed) =>
      prisma.projectOverride.upsert({
        where: { repoName: seed.repoName },
        update: {
          isFeatured: seed.featuredOrder <= 8,
          featuredOrder: seed.featuredOrder <= 8 ? seed.featuredOrder : null,
          label: seed.label,
          summary: seed.summary,
          iframeUrl: seed.iframeUrl,
        },
        create: {
          repoName: seed.repoName,
          isFeatured: seed.featuredOrder <= 8,
          featuredOrder: seed.featuredOrder <= 8 ? seed.featuredOrder : null,
          label: seed.label,
          summary: seed.summary,
          iframeUrl: seed.iframeUrl,
          hide: false,
        },
      }),
    ),
  );
}

export async function syncGithubProjects(): Promise<{ updated: number }> {
  const repos = await fetchGitHubRepos(env.GITHUB_TIMELINE_USER);

  await seedProjectOverrides();

  const operations = repos.map((repo) =>
    prisma.projectCache.upsert({
      where: { repoName: repo.name },
      update: {
        fullName: repo.full_name,
        description: repo.description,
        language: repo.language,
        homepage: repo.homepage,
        htmlUrl: repo.html_url,
        createdAtGithub: new Date(repo.created_at),
        updatedAtGithub: new Date(repo.updated_at),
        pushedAtGithub: repo.pushed_at ? new Date(repo.pushed_at) : null,
        stars: repo.stargazers_count,
        isFork: repo.fork,
        syncedAt: new Date(),
      },
      create: {
        repoName: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        language: repo.language,
        homepage: repo.homepage,
        htmlUrl: repo.html_url,
        createdAtGithub: new Date(repo.created_at),
        updatedAtGithub: new Date(repo.updated_at),
        pushedAtGithub: repo.pushed_at ? new Date(repo.pushed_at) : null,
        stars: repo.stargazers_count,
        isFork: repo.fork,
        syncedAt: new Date(),
      },
    }),
  );

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  return { updated: repos.length };
}

function mergeProjects(
  caches: Array<{
    repoName: string;
    fullName: string;
    description: string | null;
    language: string | null;
    homepage: string | null;
    htmlUrl: string;
    createdAtGithub: Date;
    updatedAtGithub: Date;
    pushedAtGithub: Date | null;
    stars: number;
    isFork: boolean;
  }>,
  overrides: Array<{
    repoName: string;
    isFeatured: boolean;
    featuredOrder: number | null;
    label: string | null;
    summary: string | null;
    iframeUrl: string | null;
    hide: boolean;
  }>,
): TimelineProject[] {
  const overrideMap = new Map(overrides.map((item) => [item.repoName, item]));

  return caches
    .filter((item) => !item.isFork)
    .map((item) => {
      const override = overrideMap.get(item.repoName);
      const fallback = curatedMap.get(item.repoName);

      return toTimelineProject({
        ...item,
        label: override?.label ?? fallback?.label ?? null,
        summary: override?.summary ?? fallback?.summary ?? item.description,
        iframeUrl: override?.iframeUrl ?? fallback?.iframeUrl ?? null,
        isFeatured: override?.isFeatured ?? (fallback ? fallback.featuredOrder <= 8 : false),
        featuredOrder: override?.featuredOrder ?? (fallback && fallback.featuredOrder <= 8 ? fallback.featuredOrder : null),
      });
    })
    .filter((item) => {
      const override = overrideMap.get(item.repoName);
      return !override?.hide;
    })
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function buildResponse(projects: TimelineProject[], source: TimelineResponse["source"]): TimelineResponse {
  const curated = projects
    .filter((project) => project.isFeatured)
    .sort((a, b) => {
      const aOrder = a.featuredOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.featuredOrder ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    })
    .slice(0, 8);

  return {
    curated,
    all: projects,
    fetchedAt: new Date().toISOString(),
    source,
  };
}

function mergeLiveReposAsFallback(): Promise<TimelineResponse> {
  return fetchGitHubRepos(env.GITHUB_TIMELINE_USER).then((repos) => {
    const projects = repos
      .filter((repo) => !repo.fork)
      .map((repo) => {
        const override = curatedMap.get(repo.name);
        return {
          repoName: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          language: repo.language,
          homepage: repo.homepage,
          htmlUrl: repo.html_url,
          createdAt: repo.created_at,
          updatedAt: repo.updated_at,
          pushedAt: repo.pushed_at,
          stars: repo.stargazers_count,
          label: override?.label ?? null,
          summary: override?.summary ?? repo.description,
          iframeUrl: override?.iframeUrl ?? null,
          isFeatured: override ? override.featuredOrder <= 8 : false,
          featuredOrder: override && override.featuredOrder <= 8 ? override.featuredOrder : null,
        } satisfies TimelineProject;
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return buildResponse(projects, "github-live");
  });
}

function isPrismaKnownError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export async function getTimelineProjects(): Promise<TimelineResponse> {
  try {
    await seedProjectOverrides();

    let caches = await prisma.projectCache.findMany({
      select: {
        repoName: true,
        fullName: true,
        description: true,
        language: true,
        homepage: true,
        htmlUrl: true,
        createdAtGithub: true,
        updatedAtGithub: true,
        pushedAtGithub: true,
        stars: true,
        isFork: true,
      },
    });

    if (caches.length === 0) {
      await syncGithubProjects();
      caches = await prisma.projectCache.findMany({
        select: {
          repoName: true,
          fullName: true,
          description: true,
          language: true,
          homepage: true,
          htmlUrl: true,
          createdAtGithub: true,
          updatedAtGithub: true,
          pushedAtGithub: true,
          stars: true,
          isFork: true,
        },
      });
    }

    const overrides = await prisma.projectOverride.findMany({
      select: {
        repoName: true,
        isFeatured: true,
        featuredOrder: true,
        label: true,
        summary: true,
        iframeUrl: true,
        hide: true,
      },
    });

    const merged = mergeProjects(caches, overrides);
    return buildResponse(merged, "database");
  } catch (error) {
    if (isPrismaKnownError(error)) {
      console.warn("Prisma timeline read failed, falling back to live GitHub:", error.code);
    } else {
      console.warn("Timeline read failed, falling back to live GitHub", error);
    }

    try {
      return await mergeLiveReposAsFallback();
    } catch (fallbackError) {
      console.error("Timeline fallback failed, using seed-only data", fallbackError);

      const seedOnlyProjects = curatedSeed
        .filter((seed) => seed.featuredOrder <= 8)
        .sort((a, b) => a.featuredOrder - b.featuredOrder)
        .map((seed) => ({
          repoName: seed.repoName,
          fullName: `QSchlegel/${seed.repoName}`,
          description: seed.summary,
          language: null,
          homepage: null,
          htmlUrl: `https://github.com/QSchlegel/${seed.repoName}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pushedAt: null,
          stars: 0,
          label: seed.label,
          summary: seed.summary,
          iframeUrl: seed.iframeUrl ?? null,
          isFeatured: true,
          featuredOrder: seed.featuredOrder,
        } satisfies TimelineProject));

      return {
        curated: seedOnlyProjects,
        all: seedOnlyProjects,
        fetchedAt: new Date().toISOString(),
        source: "seed-fallback",
      };
    }
  }
}
