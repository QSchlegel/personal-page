"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowRight, Compass, Github, Linkedin, Mail, MessageSquare, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { GitHubStatsSection } from "@/components/GitHubStatsSection";
import { SectionHeader } from "@/components/SectionHeader";
import { TimelineSection } from "@/components/TimelineSection";
import { XIcon } from "@/components/XIcon";
import { siteConfig } from "@/config/site";
import { cardReveal, sectionReveal, springSnappy, springSoft, staggerContainer } from "@/lib/motion";

export default function HomePage() {
  const reduceMotion = useReducedMotion();
  // gold sheen that sweeps around the portrait as the page scrolls.
  // Driven via a direct style write (not a MotionValue) so it updates on the
  // scroll event itself, independent of any rAF/visibility throttling.
  const reflectionRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = reflectionRef.current;
    if (!el) {
      return;
    }
    if (reduceMotion) {
      el.style.transform = "rotate(0deg)";
      return;
    }
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      el.style.transform = `rotate(${progress * 540}deg)`;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [reduceMotion]);

  return (
    <div className="home-main">
      <motion.section
        className="panel hero"
        initial={false}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.3 }}
        variants={sectionReveal}
      >
        <div className="hero-grid">
          <motion.figure
            className="hero-photo-wrap"
            initial={false}
            whileInView={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            <Image
              src="/profile.jpg"
              alt={`${siteConfig.name} profile portrait`}
              width={800}
              height={800}
              priority
              className="hero-photo"
            />
            <span ref={reflectionRef} className="hero-photo-reflection" aria-hidden="true" />
          </motion.figure>

          <div className="hero-copy">
            <p className="eyebrow">{siteConfig.heroEyebrow}</p>
            <h1>{siteConfig.name}</h1>
            <p className="hero-lead">
              I turn complex systems into{" "}
              <em className="lead-accent">products people actually enjoy using</em>.
            </p>
            <p className="hero-sub">{siteConfig.heroDescription}</p>

            <motion.div
              className="hero-actions"
              variants={staggerContainer}
              initial={false}
              whileInView={reduceMotion ? undefined : "visible"}
              viewport={{ once: true, amount: 0.45 }}
            >
              <motion.a
                variants={cardReveal}
                custom={0}
                href="#timeline"
                whileHover={reduceMotion ? undefined : { y: -2 }}
                transition={springSoft}
              >
                <ArrowRight className="icon-sm" />
                Explore Work
              </motion.a>
              <motion.div variants={cardReveal} custom={1} whileHover={reduceMotion ? undefined : { y: -2 }} transition={springSoft}>
                <a href="#contact">
                  <MessageSquare className="icon-sm" />
                  Get in Touch
                </a>
              </motion.div>
            </motion.div>

            <motion.ul
              className="hero-highlights"
              variants={staggerContainer}
              initial={false}
              whileInView={reduceMotion ? undefined : "visible"}
              viewport={{ once: true, amount: 0.35 }}
            >
              {siteConfig.heroHighlights.map((highlight, index) => (
                <motion.li key={highlight} variants={cardReveal} custom={index}>
                  {highlight}
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </div>
      </motion.section>

      <motion.section
        id="saniernavigator"
        className="panel featured-project"
        initial={false}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.3 }}
        variants={sectionReveal}
      >
        <div className="featured-project-glyph" aria-hidden="true">
          <Compass />
        </div>
        <div className="featured-project-body">
          <p className="eyebrow featured-project-badge">
            <Sparkles className="icon-sm" />
            Featured · Live Project
          </p>
          <h2>{siteConfig.featured.name}</h2>
          <p className="featured-project-tagline">{siteConfig.featured.tagline}</p>
          <p className="featured-project-desc">{siteConfig.featured.description}</p>
          <div className="featured-project-actions">
            <a
              className="featured-project-cta"
              href={siteConfig.featured.url}
              target="_blank"
              rel="noreferrer"
            >
              {siteConfig.featured.cta}
              <ArrowRight className="icon-sm" />
            </a>
          </div>
        </div>
      </motion.section>

      <motion.section
        id="about"
        className="panel about-panel"
        initial={false}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionReveal}
      >
        <SectionHeader index="01" eyebrow="Approach" title="How I Work">
          <p>
            I focus on <em className="lead-accent">clarity, speed, and trust</em>. The goal is simple: make powerful systems feel
            understandable, safe, and effortless to use.
          </p>
        </SectionHeader>

        <motion.div
          className="about-grid"
          variants={staggerContainer}
          initial={false}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={{ once: true, amount: 0.25 }}
        >
          {siteConfig.approach.map((item, index) => (
            <motion.article
              key={item.title}
              className="about-card"
              variants={cardReveal}
              custom={index}
              whileHover={reduceMotion ? undefined : { y: -4 }}
              transition={springSoft}
            >
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </motion.article>
          ))}
        </motion.div>

        <motion.div
          className="skills-cloud"
          aria-label="Core skills"
          variants={staggerContainer}
          initial={false}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={{ once: true, amount: 0.3 }}
        >
          {siteConfig.skills.map((skill, index) => (
            <motion.span
              key={skill}
              variants={cardReveal}
              custom={index}
              whileHover={reduceMotion ? undefined : { y: -2 }}
              transition={springSnappy}
            >
              {skill}
            </motion.span>
          ))}
        </motion.div>
      </motion.section>

      <GitHubStatsSection />

      <TimelineSection />

      <motion.section
        id="contact"
        className="panel"
        initial={false}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionReveal}
      >
        <SectionHeader index="04" eyebrow="Contact" title="Let&apos;s Build">
          <p>Open a secure thread or reach out directly to collaborate on product and platform work.</p>
        </SectionHeader>

        <motion.div
          className="contact-actions"
          variants={staggerContainer}
          initial={false}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={{ once: true, amount: 0.35 }}
        >
          <motion.div variants={cardReveal} custom={0} whileHover={reduceMotion ? undefined : { y: -3 }} transition={springSoft}>
            <a href={`mailto:${siteConfig.contact.email}`}>
              <Mail className="icon-sm" />
              Email Direct
            </a>
          </motion.div>
          <motion.div variants={cardReveal} custom={1} whileHover={reduceMotion ? undefined : { y: -3 }} transition={springSoft}>
            <a href={siteConfig.contact.github} target="_blank" rel="noreferrer">
              <Github className="icon-sm" />
              GitHub Repos
            </a>
          </motion.div>
          <motion.div variants={cardReveal} custom={2} whileHover={reduceMotion ? undefined : { y: -3 }} transition={springSoft}>
            <a href={siteConfig.contact.linkedin} target="_blank" rel="noreferrer">
              <Linkedin className="icon-sm" />
              LinkedIn
            </a>
          </motion.div>
          <motion.div variants={cardReveal} custom={3} whileHover={reduceMotion ? undefined : { y: -3 }} transition={springSoft}>
            <a href={siteConfig.contact.twitter} target="_blank" rel="noreferrer">
              <XIcon className="icon-sm" />
              X / Updates
            </a>
          </motion.div>
        </motion.div>
      </motion.section>
    </div>
  );
}
