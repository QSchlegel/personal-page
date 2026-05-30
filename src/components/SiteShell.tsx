"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { FloatingAuthChat } from "@/components/FloatingAuthChat";
import { QSLogo } from "@/components/QSLogo";
import { ThreeBackground } from "@/components/ThreeBackground";
import { getRouteMeta, navItems } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { easingStandard } from "@/lib/motion";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
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
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(pathname, item.href) ? "active" : undefined}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
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

      <footer className="site-footer">
        <div className="site-footer-inner">
          <span className="site-footer-copy">
            © {new Date().getFullYear()} {siteConfig.name}
          </span>
          <nav className="site-footer-links" aria-label="Footer">
            <Link href="/vault">Vault</Link>
            <Link href="/blog">Six-Pagers</Link>
            <Link href="/newsletter">Newsletter</Link>
            <a href="/blog/rss.xml">RSS</a>
            <Link href="/privacy">Privacy</Link>
          </nav>
        </div>
      </footer>

      <FloatingAuthChat />
    </div>
  );
}
