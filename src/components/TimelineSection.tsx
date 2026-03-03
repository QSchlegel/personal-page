"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronUp, ExternalLink, Globe, Github, Star } from "lucide-react";

import { IframeEmbed } from "@/components/IframeEmbed";
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

function ProjectCard({ project }: { project: TimelineProject }) {
  const [expanded, setExpanded] = useState(false);
  const summary = project.summary ?? project.description ?? "No description available yet.";
  const pushed = project.pushedAt ?? project.updatedAt;

  return (
    <article className="timeline-card">
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
          <button type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? <ChevronUp className="icon-sm" /> : <ChevronDown className="icon-sm" />}
            {expanded ? "Hide Live Preview" : "Show Live Preview"}
          </button>
        ) : null}
      </div>

      {expanded && project.iframeUrl ? <IframeEmbed src={project.iframeUrl} title={`${project.repoName} embedded UI`} /> : null}
    </article>
  );
}

export function TimelineSection() {
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

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
    <section id="timeline" className="panel timeline-panel">
      <div className="section-heading">
        <h2>Project Timeline</h2>
        <p>Featured products first, with full repository history one click away.</p>
      </div>

      {error ? <p className="status-error">{error}</p> : null}
      {!timeline && !error ? <p className="status-muted">Loading timeline...</p> : null}

      {timeline ? (
        <>
          <div className="timeline-switcher">
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

          <div className="timeline-grid">
            {projects.length > 0 ? (
              projects.map((project) => <ProjectCard key={project.repoName} project={project} />)
            ) : (
              <p className="status-muted">No projects to display.</p>
            )}
          </div>

          <div className="timeline-actions">
            <small>
              <ExternalLink className="icon-sm" />
              Source: {formatSource(timeline.source)} • Synced {new Date(timeline.fetchedAt).toLocaleString("en-US")}
            </small>
          </div>
        </>
      ) : null}
    </section>
  );
}
