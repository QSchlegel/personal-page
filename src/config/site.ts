import { env } from "@/lib/env";

export const siteConfig = {
  name: "QS",
  title: "QS | Engineer, Builder, Systems Thinker",
  heroTitle: "Quirin Schlegel | Engineer, Builder, Systems Thinker",
  description:
    "Portfolio and communications hub for QS. Timeline-driven projects, immersive Three.js visuals, and authenticated collaboration.",
  heroDescription:
    "Portfolio and communications hub for Quirin Schlegel. Timeline-driven projects, immersive Three.js visuals, and authenticated collaboration.",
  about:
    "I build production systems where product taste meets platform rigor. Most of my recent work sits at the boundary of developer tooling, automation, and distributed interfaces.",
  skills: [
    "TypeScript",
    "Next.js",
    "Prisma + Postgres",
    "Automation",
    "Distributed Systems",
    "Developer Experience",
    "AI Workflows",
    "Security-aware Architecture",
  ],
  contact: {
    github: env.PUBLIC_GITHUB_URL,
    twitter: env.PUBLIC_TWITTER_URL ?? "https://x.com/SchlegelQuirin",
    email: env.PUBLIC_EMAIL,
  },
} as const;
