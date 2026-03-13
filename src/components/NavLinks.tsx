"use client";

import { useEffect, useState } from "react";

const NAV_SECTIONS = [
  { id: "about", label: "About" },
  { id: "timeline", label: "Projects" },
  { id: "contact", label: "Contact" },
] as const;

type SectionId = (typeof NAV_SECTIONS)[number]["id"];

export function NavLinks() {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);

  useEffect(() => {
    const elements = NAV_SECTIONS.map(({ id }) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );

    if (elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id as SectionId);
        }
      },
      {
        rootMargin: "-20% 0px -30% 0px",
        threshold: 0,
      },
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="top-nav-links" aria-label="Primary">
      {NAV_SECTIONS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          className={activeSection === id ? "active" : undefined}
          aria-current={activeSection === id ? "true" : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
