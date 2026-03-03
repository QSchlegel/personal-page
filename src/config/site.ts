import { env } from "@/lib/env";

export const siteConfig = {
  name: "Quirin Schlegel",
  shortName: "QS",
  title: "Quirin Schlegel | Product Engineer for AI Systems",
  heroEyebrow: "Product Engineering for AI Systems",
  heroTitle: "I design and ship reliable AI products that people actually use.",
  description:
    "Portfolio for Quirin Schlegel. Product engineering across agent infrastructure, secure runtimes, and developer-first platforms.",
  heroDescription:
    "I work at the edge of agent tooling, security boundaries, and developer experience. This site tracks active repos, technical direction, and ways to collaborate.",
  about:
    "My work blends product taste with platform rigor: clear UX on top, strong system boundaries underneath. Recent projects focus on agent operations, policy controls, and blockchain-native tooling.",
  heroHighlights: [
    "Agent runtime governance and observability",
    "Secure-by-default architecture for automation",
    "Developer workflows that stay fast under scale",
  ],
  approach: [
    {
      title: "Product Direction",
      description: "Define a sharp product loop first: who it serves, what risk it removes, and how success is measured.",
    },
    {
      title: "System Design",
      description: "Build dependable infrastructure with explicit policy boundaries, predictable behavior, and traceability.",
    },
    {
      title: "Execution",
      description: "Ship iteratively with real user feedback and measurable quality gates, not one-off demos.",
    },
  ],
  skills: [
    "TypeScript",
    "Next.js",
    "Prisma + Postgres",
    "Agent Infrastructure",
    "Distributed Systems",
    "Developer Experience",
    "AI Product Workflows",
    "Security-focused Architecture",
  ],
  contact: {
    github: env.PUBLIC_GITHUB_URL,
    twitter: env.PUBLIC_TWITTER_URL ?? "https://x.com/SchlegelQuirin",
    email: env.PUBLIC_EMAIL,
  },
} as const;
