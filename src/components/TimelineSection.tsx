"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronUp, ExternalLink, Globe, Github, Star } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { IframeEmbed } from "@/components/IframeEmbed";
import { cardReveal, easingStandard, sectionReveal, springSoft, staggerContainer } from "@/lib/motion";
import type { TimelineProject, TimelineResponse } from "@/lib/types";

function formatProjectDate(value: string | null): string {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatSource(source: TimelineResponse["source"]): string {
  if (source === "database") {
    return "Cached + Overrides";
  }

  if (source === "github-live") {
    return "GitHub Live";
  }

  return "Seed Fallback";
}

function ProjectCard({ project, index }: { project: TimelineProject; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const summary = project.summary ?? project.description ?? "No description available yet.";
  const pushed = project.pushedAt ?? project.updatedAt;

  return (
    <motion.article
      className="timeline-card"
      layout={!reduceMotion}
      initial={reduceMotion ? false : "hidden"}
      animate={reduceMotion ? undefined : "visible"}
      variants={cardReveal}
      custom={index}
      whileHover={reduceMotion ? undefined : { y: -3, transition: springSoft }}
    >
      <header>
        <div className="timeline-title-row">
          <h3>{project.repoName}</h3>
          <div className="timeline-badges">
            {project.language ? <span className="timeline-chip">{project.language}</span> : null}
            {project.label ? <span className="timeline-chip timeline-chip-accent">{project.label}</span> : null}
          </div>
        </div>
      </header>

      <p className="timeline-summary">{summary}</p>

      <ul className="timeline-facts">
        <li>
          <Calendar className="icon-sm" />
          Started {formatProjectDate(project.createdAt)}
        </li>
        <li>
          <Calendar className="icon-sm" />
          Updated {formatProjectDate(pushed)}
        </li>
        <li>
          <Star className="icon-sm" />
          {project.stars} star{project.stars === 1 ? "" : "s"}
        </li>
      </ul>

      <div className="timeline-meta-row">
        <a href={project.htmlUrl} target="_blank" rel="noreferrer">
          <Github className="icon-sm" />
          Source
        </a>
        {project.homepage ? (
          <a href={project.homepage} target="_blank" rel="noreferrer">
            <Globe className="icon-sm" />
            Live Site
          </a>
        ) : null}
        {project.iframeUrl ? (
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
            {expanded ? <ChevronUp className="icon-sm" /> : <ChevronDown className="icon-sm" />}
            {expanded ? "Hide Preview" : "Show Preview"}
          </button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {expanded && project.iframeUrl ? (
          <motion.div
            key="preview"
            className="timeline-preview-wrap"
            initial={reduceMotion ? false : { opacity: 0, height: 0, marginTop: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto", marginTop: 14 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.34, ease: easingStandard }}
          >
            <IframeEmbed src={project.iframeUrl} title={`${project.repoName} embedded UI`} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

export function TimelineSection() {
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/timeline/projects", {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Timeline request failed (${response.status}).`);
        }

        const data = (await response.json()) as TimelineResponse;
        setTimeline(data);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Timeline unavailable.");
      }
    }

    void load();

    return () => controller.abort();
  }, []);

  const projects = useMemo(() => {
    if (!timeline) {
      return [];
    }

    return showAll ? timeline.all : timeline.curated;
  }, [timeline, showAll]);

  const featuredCount = timeline?.curated.length ?? 0;
  const allCount = timeline?.all.length ?? 0;

  return (
    <motion.section
      id="timeline"
      className="panel timeline-panel"
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.15 }}
      variants={sectionReveal}
    >
      <div className="section-heading">
        <h2>Project Timeline</h2>
        <p>Featured work first, with full repository history available when you want more depth.</p>
      </div>

      {error ? <p className="status-error">{error}</p> : null}
      {!timeline && !error ? <p className="status-muted">Loading timeline...</p> : null}

      {timeline ? (
        <>
          <div className="timeline-switcher" role="tablist" aria-label="Project scope">
            <button
              type="button"
              className={!showAll ? "active" : ""}
              onClick={() => setShowAll(false)}
              aria-pressed={!showAll}
            >
              Featured ({featuredCount})
            </button>
            <button
              type="button"
              className={showAll ? "active" : ""}
              onClick={() => setShowAll(true)}
              aria-pressed={showAll}
            >
              All Repos ({allCount})
            </button>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={showAll ? "all" : "featured"}
              className="timeline-grid"
              variants={staggerContainer}
              initial={reduceMotion ? false : "hidden"}
              animate={reduceMotion ? undefined : "visible"}
              exit={reduceMotion ? undefined : { opacity: 0, transition: { duration: 0.16 } }}
            >
              {projects.length > 0 ? (
                projects.map((project, index) => <ProjectCard key={project.repoName} project={project} index={index} />)
              ) : (
                <p className="status-muted">No projects to display.</p>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="timeline-actions">
            <small>
              <ExternalLink className="icon-sm" />
              Source: {formatSource(timeline.source)} • Synced {new Date(timeline.fetchedAt).toLocaleString("en-US")}
            </small>
          </div>
        </>
      ) : null}
    </motion.section>
  );
}
