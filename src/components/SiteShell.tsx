"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { FloatingAuthChat } from "@/components/FloatingAuthChat";
import { QSLogo } from "@/components/QSLogo";
import { ThreeBackground } from "@/components/ThreeBackground";
import { getRouteMeta, navItems } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { easingStandard } from "@/lib/motion";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(href);
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const routeMeta = getRouteMeta(pathname);
  const reduceMotion = useReducedMotion();

  return (
    <div className={`page-shell page-shell-${routeMeta.motionProfile}`}>
      <ThreeBackground profile={routeMeta.motionProfile} />

      <header className="site-nav">
        <div className="site-nav-inner">
          <Link href="/" className="brand" aria-label={`${siteConfig.name} homepage`}>
            <QSLogo className="brand-logo" />
          </Link>

          <nav className="site-nav-links" aria-label="Primary">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link href="/comms" className="site-nav-cta">
            <MessageSquare className="icon-sm" />
            Secure Chat
          </Link>
        </div>
      </header>

      <main className="site-main">
        <AnimatePresence mode="wait" initial={false}>
          {routeMeta.showIntro ? (
            <motion.section
              key={`intro-${pathname}`}
              className="panel page-intro"
              initial={false}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.42, ease: easingStandard }}
            >
              <p className="eyebrow">{siteConfig.shortName} Workspace</p>
              <h1>{routeMeta.title}</h1>
              <p>{routeMeta.description}</p>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <div className="site-content">{children}</div>
      </main>

      <FloatingAuthChat />
    </div>
  );
}
