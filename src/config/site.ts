import { env } from "@/lib/env";

export const siteConfig = {
  name: "Quirin Schlegel",
  shortName: "QS",
  title: "Quirin Schlegel | Product Engineer",
  heroEyebrow: "Product Engineering",
  heroTitle: "I turn complex systems into products people actually enjoy using.",
  description:
    "Portfolio for Quirin Schlegel. Product engineering across secure runtimes, agent workflows, and developer-first platforms.",
  heroDescription:
    "From architecture to interaction design, I ship clear and reliable software for open-source teams working on hard technical problems.",
  about:
    "I focus on clarity, speed, and trust. The goal is simple: make powerful systems feel understandable, safe, and effortless to use.",
  heroHighlights: [
    "End-to-end delivery across backend guardrails and front-end experience",
    "Security-aware product decisions that hold up in production",
    "Open-source collaboration built for momentum and maintainability",
  ],
  approach: [
    {
      title: "Set Direction",
      description: "Translate complex technical constraints into a focused product plan with clear outcomes.",
    },
    {
      title: "Design For Flow",
      description: "Remove friction in the interaction layer so users can stay in the work, not the interface.",
    },
    {
      title: "Ship With Confidence",
      description: "Build with practical guardrails and iterate quickly using real-world feedback.",
    },
  ],
  skills: [
    "TypeScript",
    "Next.js",
    "Prisma + Postgres",
    "AI Workflow Products",
    "Distributed Systems",
    "Developer Experience",
    "Secure Runtime Design",
    "Platform Engineering",
  ],
  contact: {
    github: env.PUBLIC_GITHUB_URL,
    twitter: env.PUBLIC_TWITTER_URL ?? "https://x.com/SchlegelQuirin",
    email: env.PUBLIC_EMAIL,
  },
} as const;
