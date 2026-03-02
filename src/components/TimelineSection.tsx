"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronUp, ExternalLink, Globe, Github } from "lucide-react";

import { IframeEmbed } from "@/components/IframeEmbed";
import type { TimelineProject, TimelineResponse } from "@/lib/types";

function formatProjectDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function ProjectCard({ project }: { project: TimelineProject }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="timeline-card">
      <header>
        <div className="timeline-title-row">
          <h3>{project.repoName}</h3>
          <span>
            <Calendar className="icon-sm" />
            {formatProjectDate(project.createdAt)}
          </span>
        </div>
        <p className="timeline-label">{project.label ?? "Project"}</p>
      </header>

      <p>{project.summary ?? project.description ?? "No description available."}</p>

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
            {expanded ? "Hide Embedded UI" : "Show Embedded UI"}
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

  return (
    <section id="timeline" className="panel timeline-panel">
      <div className="section-heading">
        <h2>Project Timeline</h2>
        <p>From foundational experiments to current production tracks.</p>
      </div>

      {error ? <p className="status-error">{error}</p> : null}
      {!timeline && !error ? <p className="status-muted">Loading timeline...</p> : null}

      {timeline ? (
        <>
          <div className="timeline-grid">
            {projects.map((project) => (
              <ProjectCard key={project.repoName} project={project} />
            ))}
          </div>

          <div className="timeline-actions">
            <button type="button" onClick={() => setShowAll((value) => !value)}>
              {showAll ? <ChevronUp className="icon-sm" /> : <ChevronDown className="icon-sm" />}
              {showAll ? "Show Curated 8" : "Show All Projects"}
            </button>
            <small>
              <ExternalLink className="icon-sm" />
              Source: {timeline.source} • Synced {new Date(timeline.fetchedAt).toLocaleString("en-US")}
            </small>
          </div>
        </>
      ) : null}
    </section>
  );
}
