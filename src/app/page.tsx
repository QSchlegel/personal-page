import Link from "next/link";
import { Github, Mail, MessageSquare } from "lucide-react";

import { FloatingAuthChat } from "@/components/FloatingAuthChat";
import { ThreeBackground } from "@/components/ThreeBackground";
import { TimelineSection } from "@/components/TimelineSection";
import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <div className="page-shell">
      <ThreeBackground />

      <header className="top-nav">
        <Link href="/" className="brand">
          {siteConfig.name}
        </Link>
      </header>

      <main className="main-content">
        <section className="hero panel">
          <p className="eyebrow">Portfolio + Communication Hub</p>
          <h1>{siteConfig.heroTitle}</h1>
          <p>{siteConfig.heroDescription}</p>
        </section>

        <section id="about" className="panel">
          <div className="section-heading">
            <h2>About</h2>
            <p>{siteConfig.about}</p>
          </div>

          <div className="skills-cloud">
            {siteConfig.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </section>

        <TimelineSection />

        <section id="contact" className="panel">
          <div className="section-heading">
            <h2>Contact</h2>
            <p>Start an authenticated chat, or reach out through social channels.</p>
          </div>

          <div className="contact-actions">
            <Link href="/comms">
              <MessageSquare className="icon-sm" />
              Contact Chat
            </Link>
            <a href={siteConfig.contact.twitter} target="_blank" rel="noreferrer">
              <span className="icon-x">X</span>
              X
            </a>
            <a href={siteConfig.contact.github} target="_blank" rel="noreferrer">
              <Github className="icon-sm" />
              GitHub
            </a>
            <a href={`mailto:${siteConfig.contact.email}`}>
              <Mail className="icon-sm" />
              Email
            </a>
          </div>
        </section>
      </main>

      <FloatingAuthChat />
    </div>
  );
}
