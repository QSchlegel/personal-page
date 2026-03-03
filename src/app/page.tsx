import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Github, Mail, MessageSquare } from "lucide-react";

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
          {siteConfig.shortName}
        </Link>

        <nav className="top-nav-links" aria-label="Primary">
          <a href="#about">About</a>
          <a href="#timeline">Projects</a>
          <a href="#contact">Contact</a>
        </nav>

        <Link href="/comms" className="top-nav-cta">
          <MessageSquare className="icon-sm" />
          Secure Chat
        </Link>
      </header>

      <main className="main-content">
        <section className="hero panel">
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">{siteConfig.heroEyebrow}</p>
              <h1>{siteConfig.heroTitle}</h1>
              <p className="hero-lead">{siteConfig.heroDescription}</p>

              <div className="hero-actions">
                <a href="#timeline">
                  <ArrowRight className="icon-sm" />
                  Explore Projects
                </a>
                <Link href="/comms">
                  <MessageSquare className="icon-sm" />
                  Start Secure Chat
                </Link>
              </div>

              <ul className="hero-highlights">
                {siteConfig.heroHighlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </div>

            <figure className="hero-photo-wrap">
              <Image
                src="/profile.jpg"
                alt={`${siteConfig.name} profile portrait`}
                width={1080}
                height={1350}
                priority
                className="hero-photo"
              />
            </figure>
          </div>
        </section>

        <section id="about" className="panel about-panel">
          <div className="section-heading">
            <h2>How I Work</h2>
            <p>{siteConfig.about}</p>
          </div>

          <div className="about-grid">
            {siteConfig.approach.map((item) => (
              <article key={item.title} className="about-card">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
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
            <p>Open a secure thread or reach out directly for product, platform, or collaboration work.</p>
          </div>

          <div className="contact-actions">
            <Link href="/comms">
              <MessageSquare className="icon-sm" />
              Open Secure Chat
            </Link>
            <a href={siteConfig.contact.twitter} target="_blank" rel="noreferrer">
              <span className="icon-x">X</span>
              X / Updates
            </a>
            <a href={siteConfig.contact.github} target="_blank" rel="noreferrer">
              <Github className="icon-sm" />
              GitHub Repos
            </a>
            <a href={`mailto:${siteConfig.contact.email}`}>
              <Mail className="icon-sm" />
              Email Direct
            </a>
          </div>
        </section>
      </main>

      <FloatingAuthChat />
    </div>
  );
}
