"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Github, Mail, MessageSquare } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { TimelineSection } from "@/components/TimelineSection";
import { siteConfig } from "@/config/site";
import { cardReveal, fadeInScale, sectionReveal, springSoft, springSnappy, staggerContainer } from "@/lib/motion";

export default function HomePage() {
  const reduceMotion = useReducedMotion();

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
          <div className="hero-copy">
            <p className="eyebrow">{siteConfig.heroEyebrow}</p>
            <h1>{siteConfig.heroTitle}</h1>
            <p className="hero-lead">{siteConfig.heroDescription}</p>

            <motion.div
              className="hero-actions"
              variants={staggerContainer}
              initial={false}
              whileInView={reduceMotion ? undefined : "visible"}
              viewport={{ once: true, amount: 0.45 }}
            >
              <motion.a variants={cardReveal} custom={0} href="#timeline" whileHover={{ y: -2 }} transition={springSoft}>
                <ArrowRight className="icon-sm" />
                Explore Projects
              </motion.a>
              <motion.div variants={cardReveal} custom={1} whileHover={reduceMotion ? undefined : { y: -2 }} transition={springSoft}>
                <Link href="/comms">
                  <MessageSquare className="icon-sm" />
                  Start Secure Chat
                </Link>
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

          <motion.figure
            className="hero-photo-wrap"
            initial={false}
            whileInView={reduceMotion ? undefined : { opacity: 1, x: 0, scale: 1 }}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.75 }}
          >
            <Image
              src="/profile.jpg"
              alt={`${siteConfig.name} profile portrait`}
              width={1080}
              height={1350}
              priority
              className="hero-photo"
            />
          </motion.figure>
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
        <div className="section-heading">
          <h2>How I Work</h2>
          <p>{siteConfig.about}</p>
        </div>

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
              whileHover={reduceMotion ? undefined : { y: -2, scale: 1.05 }}
              transition={springSnappy}
            >
              {skill}
            </motion.span>
          ))}
        </motion.div>
      </motion.section>

      <TimelineSection />

      <motion.section
        id="contact"
        className="panel"
        initial={false}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionReveal}
      >
        <div className="section-heading">
          <h2>Let&apos;s Build</h2>
          <p>Open a secure thread or reach out directly to collaborate on product and platform work.</p>
        </div>

        <motion.div
          className="contact-actions"
          variants={staggerContainer}
          initial={false}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={{ once: true, amount: 0.35 }}
        >
          <motion.div variants={cardReveal} custom={0} whileHover={reduceMotion ? undefined : { y: -3, scale: 1.02 }} transition={springSoft}>
            <Link href="/comms">
              <MessageSquare className="icon-sm" />
              Open Secure Chat
            </Link>
          </motion.div>
          <motion.div variants={cardReveal} custom={1} whileHover={reduceMotion ? undefined : { y: -3, scale: 1.02 }} transition={springSoft}>
            <a href={siteConfig.contact.twitter} target="_blank" rel="noreferrer">
              <span className="icon-x">X</span>
              X / Updates
            </a>
          </motion.div>
          <motion.div variants={cardReveal} custom={2} whileHover={reduceMotion ? undefined : { y: -3, scale: 1.02 }} transition={springSoft}>
            <a href={siteConfig.contact.github} target="_blank" rel="noreferrer">
              <Github className="icon-sm" />
              GitHub Repos
            </a>
          </motion.div>
          <motion.div variants={cardReveal} custom={3} whileHover={reduceMotion ? undefined : { y: -3, scale: 1.02 }} transition={springSoft}>
            <a href={`mailto:${siteConfig.contact.email}`}>
              <Mail className="icon-sm" />
              Email Direct
            </a>
          </motion.div>
        </motion.div>
      </motion.section>
    </div>
  );
}
