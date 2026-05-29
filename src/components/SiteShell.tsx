"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { FloatingAuthChat } from "@/components/FloatingAuthChat";
import { Wordmark } from "@/components/Wordmark";
import { getRouteMeta } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { easingStandard } from "@/lib/motion";

function mastheadStamp(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `Berlin · ${now.getFullYear()}.${month}`;
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const routeMeta = getRouteMeta(pathname);
  const reduceMotion = useReducedMotion();
  // When the hero portrait scrolls up under the nav, dock a small avatar into
  // the header so the face keeps "watching" the reader as they scroll.
  const [docked, setDocked] = useState(false);
  const reflectionRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const photo = document.querySelector(".hero-photo-wrap");
    if (!photo) {
      return;
    }
    const onScroll = () => {
      // dock the avatar as the portrait scrolls up under the sticky nav
      setDocked(photo.getBoundingClientRect().bottom < 130);
      // sweep the golden reflection around the header avatar, synced to scroll
      const reflection = reflectionRef.current;
      if (reflection && !reduceMotion) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? window.scrollY / max : 0;
        reflection.style.transform = `rotate(${progress * 540}deg)`;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const raf = requestAnimationFrame(onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      setDocked(false);
    };
  }, [pathname, reduceMotion]);

  return (
    <div className="page-shell">
      <header className="site-nav">
        <div className="site-nav-inner">
          <Link
            href="/"
            className="brand"
            data-docked={docked}
            aria-label={`${siteConfig.name} homepage`}
          >
            <Wordmark />
            <span className="brand-avatar" aria-hidden="true">
              <span className="brand-avatar-reflection" ref={reflectionRef} />
            </span>
          </Link>
          <nav className="site-nav-links" aria-label="Primary">
            <a href="#timeline">Work</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </header>

      <div className="masthead" aria-hidden="true">
        <span>Curriculum Vitae · {siteConfig.name}</span>
        <span suppressHydrationWarning>{mastheadStamp()}</span>
      </div>

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
        <div className="site-footer-mark">
          <svg className="seal" viewBox="0 0 100 100" aria-hidden="true">
            <g className="seal-rotate">
              <defs>
                <path
                  id="seal-text-path"
                  d="M 50 50 m -34 0 a 34 34 0 1 1 68 0 a 34 34 0 1 1 -68 0"
                />
              </defs>
              <circle className="seal-ring" cx="50" cy="50" r="46" />
              <circle className="seal-ring" cx="50" cy="50" r="22" />
              <text className="seal-text">
                <textPath href="#seal-text-path" startOffset="0">
                  · PRODUCT ENGINEERING · OPEN SOURCE · BERLIN&nbsp;
                </textPath>
              </text>
            </g>
            <text className="seal-monogram" x="50" y="50" dominantBaseline="central">
              QS
            </text>
          </svg>
          <span>
            © {new Date().getFullYear()} {siteConfig.name} · Built in public
          </span>
        </div>
        <nav className="site-footer-links" aria-label="Elsewhere">
          <a href={siteConfig.contact.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={siteConfig.contact.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
          <a href={siteConfig.contact.twitter} target="_blank" rel="noreferrer">
            X
          </a>
          <a href={`mailto:${siteConfig.contact.email}`}>Email</a>
        </nav>
      </footer>

      <FloatingAuthChat />
    </div>
  );
}
