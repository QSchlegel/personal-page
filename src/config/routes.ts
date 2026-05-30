export type MotionProfile = "bold" | "calm";

export interface RouteMeta {
  title: string;
  description: string;
  showIntro: boolean;
  motionProfile: MotionProfile;
}

export interface NavItem {
  href: string;
  label: string;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/vault", label: "Vault" },
  { href: "/blog", label: "Six-Pagers" },
  { href: "/newsletter", label: "Newsletter" },
];

export function getRouteMeta(pathname: string): RouteMeta {
  if (pathname === "/") {
    return {
      title: "Product Engineering for Complex Workflows",
      description: "Clarity-first software for teams shipping in public under real technical constraints.",
      showIntro: false,
      motionProfile: "bold",
    };
  }

  if (pathname.startsWith("/blog")) {
    return {
      title: "Six-Pagers",
      description: "Long-form, illustrated monographs from the knowledge vault.",
      showIntro: false,
      motionProfile: "calm",
    };
  }

  if (pathname.startsWith("/vault")) {
    return {
      title: "The Vault",
      description: "An evolving knowledge graph of interlinked notes.",
      showIntro: false,
      motionProfile: "calm",
    };
  }

  if (pathname.startsWith("/newsletter")) {
    return {
      title: "Newsletter",
      description: "Get an email when a new six-pager is published.",
      showIntro: false,
      motionProfile: "calm",
    };
  }

  if (pathname.startsWith("/comms")) {
    return {
      title: "Authenticated Comms",
      description: "Private 1:1 conversations with secure access and practical collaboration tools.",
      showIntro: true,
      motionProfile: "calm",
    };
  }

  if (pathname.startsWith("/admin/inbox")) {
    return {
      title: "Admin Inbox",
      description: "Review thread activity, resolve status, and control automation behavior in one place.",
      showIntro: true,
      motionProfile: "calm",
    };
  }

  if (pathname.startsWith("/settings/bot")) {
    return {
      title: "Bot Settings",
      description: "Manage bot API credentials and monitor key usage with a secure operational workflow.",
      showIntro: true,
      motionProfile: "calm",
    };
  }

  return {
    title: "QS Platform",
    description: "Open-source product engineering across secure systems and developer-first workflows.",
    showIntro: true,
    motionProfile: "calm",
  };
}
