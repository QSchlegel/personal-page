"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { easingStandard } from "@/lib/motion";
import type { TimelineProject } from "@/lib/types";

function toYearFloat(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getFullYear() + date.getMonth() / 12;
}

type Tone = "navy" | "deep" | "accent";

interface GanttRow {
  key: string;
  name: string;
  sub: string;
  left: number;
  width: number;
  tone: Tone;
  ongoing: boolean;
}

interface GanttModel {
  rows: GanttRow[];
  ticks: number[];
  minYear: number;
  span: number;
  nowPercent: number;
}

const MAX_ROWS = 10;

/**
 * A CV-style Gantt chart built entirely from live GitHub repo data: each repo's
 * createdAt → last-activity span becomes a bar on a shared year axis. The single
 * most-recently-active repo gets the rust bar (mirroring the CV's one accent bar);
 * featured repos render in deeper navy. Bars grow in on scroll unless the visitor
 * prefers reduced motion.
 */
export function ProjectGantt({ projects }: { projects: TimelineProject[] }) {
  const reduceMotion = useReducedMotion();

  const model = useMemo<GanttModel>(() => {
    const now = new Date();
    const currentFloat = now.getFullYear() + now.getMonth() / 12;

    const items = projects
      .map((project) => {
        const start = toYearFloat(project.createdAt);
        const endRaw = toYearFloat(project.pushedAt ?? project.updatedAt) ?? currentFloat;
        return { project, start, end: start === null ? endRaw : Math.max(endRaw, start) };
      })
      .filter((item): item is { project: TimelineProject; start: number; end: number } => item.start !== null);

    if (items.length === 0) {
      return { rows: [], ticks: [], minYear: 0, span: 1, nowPercent: 0 };
    }

    // Pick the most relevant repos (featured, then stars, then recency), then
    // display them oldest-first like a CV timeline.
    const selected = [...items]
      .sort(
        (a, b) =>
          Number(b.project.isFeatured) - Number(a.project.isFeatured) ||
          (a.project.featuredOrder ?? 999) - (b.project.featuredOrder ?? 999) ||
          b.project.stars - a.project.stars ||
          b.end - a.end,
      )
      .slice(0, MAX_ROWS)
      .sort((a, b) => a.start - b.start);

    const minYear = Math.floor(Math.min(...selected.map((item) => item.start)));
    const maxYear = Math.ceil(Math.max(currentFloat, ...selected.map((item) => item.end)));
    const span = Math.max(1, maxYear - minYear);

    let accentIndex = 0;
    let latest = -Infinity;
    selected.forEach((item, index) => {
      if (item.end > latest) {
        latest = item.end;
        accentIndex = index;
      }
    });

    const rows: GanttRow[] = selected.map((item, index) => {
      const left = Math.max(0, Math.min(100, ((item.start - minYear) / span) * 100));
      const rawWidth = ((item.end - item.start) / span) * 100;
      const width = Math.max(2.5, Math.min(100 - left, rawWidth));
      const sub = [item.project.language, item.project.label].filter(Boolean).join(" · ") || "Repository";
      const tone: Tone = index === accentIndex ? "accent" : item.project.isFeatured ? "deep" : "navy";
      const ongoing = Boolean(item.project.ongoing) || currentFloat - item.end <= 0.12;
      return { key: item.project.repoName, name: item.project.repoName, sub, left, width, tone, ongoing };
    });

    const step = span > 8 ? 2 : 1;
    const ticks: number[] = [];
    for (let year = minYear; year <= maxYear; year += step) {
      ticks.push(year);
    }
    if (ticks[ticks.length - 1] !== maxYear) {
      ticks.push(maxYear);
    }

    const nowPercent = Math.max(0, Math.min(100, ((currentFloat - minYear) / span) * 100));

    return { rows, ticks, minYear, span, nowPercent };
  }, [projects]);

  if (model.rows.length === 0) {
    return <p className="status-muted">No dated repositories to chart.</p>;
  }

  const { rows, ticks, minYear, span, nowPercent } = model;

  return (
    <div>
      <div className="gantt">
        <div className="gantt-now" aria-hidden="true">
          <span />
          <div className="gantt-now-track">
            <span className="gantt-now-line" style={{ left: `${nowPercent}%` }}>
              <span className="gantt-now-label">Now</span>
            </span>
          </div>
        </div>
        {rows.map((row, index) => (
          <div className="gantt-row" key={row.key}>
            <div className="gantt-label">
              <strong>{row.name}</strong>
              <span>{row.sub}</span>
            </div>
            <div className="gantt-track">
              <motion.div
                className={[
                  "gantt-bar",
                  row.tone === "deep" ? "gantt-bar-deep" : row.tone === "accent" ? "gantt-bar-accent" : "",
                  row.ongoing ? "gantt-bar-ongoing" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ left: `${row.left}%`, width: `${row.width}%` }}
                initial={reduceMotion ? false : { scaleX: 0 }}
                whileInView={reduceMotion ? undefined : { scaleX: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.55, delay: index * 0.06, ease: easingStandard }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="gantt-axis" aria-hidden="true">
        <span />
        <div className="gantt-axis-track">
          {ticks.map((year) => (
            <span
              key={year}
              className="gantt-tick"
              style={{ left: `${Math.max(0, Math.min(100, ((year - minYear) / span) * 100))}%` }}
            >
              {year}
            </span>
          ))}
        </div>
      </div>

      <div className="gantt-legend" aria-hidden="true">
        <span>
          <i className="accent" /> Most recent
        </span>
        <span>
          <i className="deep" /> Featured
        </span>
        <span>
          <i /> Repository
        </span>
      </div>
    </div>
  );
}
