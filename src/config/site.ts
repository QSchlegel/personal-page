import { env } from "@/lib/env";

export const siteConfig = {
  name: "Quirin Schlegel",
  shortName: "QS",
  title: "Quirin Schlegel | Open-Source Product Engineer",
  heroEyebrow: "Open-Source Product Engineering",
  heroTitle: "I build reliable public products for complex technical workflows.",
  description:
    "Portfolio for Quirin Schlegel. Product engineering across agent infrastructure, secure runtimes, and developer-first platforms.",
  heroDescription:
    "I lead and contribute to open-source projects where security, collaboration, and developer experience need to work together.",
  about:
    "I turn complex infrastructure problems into clear product experiences, combining strong backend guardrails with practical, usable interfaces. I care about visual clarity and calm interaction design.",
  heroHighlights: [
    "Open-source leadership across multi-contributor builds",
    "Security-aware full-stack delivery, from API boundaries to UX",
    "Distributed systems and blockchain tooling with practical outcomes",
  ],
  approach: [
    {
      title: "Lead with Clarity",
      description: "Define a simple product direction so collaborators can execute without ambiguity.",
    },
    {
      title: "Build with Guardrails",
      description: "Use explicit boundaries and reliable defaults to keep systems safe and predictable.",
    },
    {
      title: "Ship in Public",
      description: "Iterate transparently, document decisions, and improve from real-world feedback.",
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
