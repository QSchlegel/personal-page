"use client";

import { useEffect, useState } from "react";
import { Calendar, FolderGit2, Github, Star, Trophy } from "lucide-react";
import { animate, motion, useReducedMotion } from "framer-motion";

import { SectionHeader } from "@/components/SectionHeader";
import { cardReveal, easingStandard, sectionReveal, staggerContainer } from "@/lib/motion";
import type { GitHubStatsResponse } from "@/lib/types";

function formatSource(source: GitHubStatsResponse["source"]): string {
  if (source === "github-live") {
    return "GitHub Live";
  }

  return "Seed Fallback";
}

function formatLatestPush(value: string | null): string {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Animated count-up; resolves instantly when reduced motion is requested. */
function CountUp({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const controls = animate(0, value, {
      duration: 1.1,
      ease: easingStandard,
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });

    return () => controls.stop();
  }, [value, reduceMotion]);

  const shown = reduceMotion ? value : display;
  return <>{new Intl.NumberFormat("en-US").format(shown)}</>;
}

/** Small decorative sparkline that line-draws under a stat (aria-hidden). */
function StatSpark({ seed }: { seed: number }) {
  const base = [4, 9, 6, 12, 8, 15, 11, 19, 16, 22];
  const values = base.map((value, index) => value + ((seed * 3 + index) % 4));
  const max = Math.max(...values);
  const stepX = 100 / (values.length - 1);
  const points = values
    .map((value, index) => `${(index * stepX).toFixed(1)},${(23 - (value / max) * 21).toFixed(1)}`)
    .join(" ");

  return (
    <svg className="stats-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        className="stats-spark-line stats-spark-dash"
        points={points}
        pathLength={100}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function GitHubStatsSection() {
  const [stats, setStats] = useState<GitHubStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/github/stats", {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`GitHub stats request failed (${response.status}).`);
        }

        const payload = (await response.json()) as GitHubStatsResponse;
        setStats(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "GitHub stats unavailable.");
      }
    }

    void load();

    return () => controller.abort();
  }, []);

  return (
    <motion.section
      id="stats"
      className="panel stats-panel"
      initial={false}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionReveal}
    >
      <SectionHeader index="02" eyebrow="Signal" title="GitHub Stats">
        <p>A quick snapshot of public repository output and activity.</p>
      </SectionHeader>

      {error ? <p className="status-error">{error}</p> : null}
      {!stats && !error ? <p className="status-muted">Loading stats…</p> : null}

      {stats ? (
        <>
          <motion.div
            className="stats-grid"
            variants={staggerContainer}
            initial={false}
            animate={reduceMotion ? undefined : "visible"}
          >
            <motion.article className="stats-card" variants={cardReveal} custom={0}>
              <p className="stats-label">
                <FolderGit2 className="icon-sm" />
                Public Repos
              </p>
              <strong>
                <CountUp value={stats.repoCount} />
              </strong>
              <StatSpark seed={1} />
            </motion.article>

            <motion.article className="stats-card" variants={cardReveal} custom={1}>
              <p className="stats-label">
                <Star className="icon-sm" />
                Total Stars
              </p>
              <strong>
                <CountUp value={stats.totalStars} />
              </strong>
              <StatSpark seed={2} />
            </motion.article>

            <motion.article className="stats-card" variants={cardReveal} custom={2}>
              <p className="stats-label">
                <Trophy className="icon-sm" />
                Featured Repos
              </p>
              <strong>
                <CountUp value={stats.featuredCount} />
              </strong>
              <StatSpark seed={3} />
            </motion.article>

            <motion.article className="stats-card" variants={cardReveal} custom={3}>
              <p className="stats-label">
                <Calendar className="icon-sm" />
                Latest Push
              </p>
              <strong className="stats-date">{formatLatestPush(stats.latestPushAt)}</strong>
            </motion.article>
          </motion.div>

          <div className="stats-meta">
            <small>
              <Github className="icon-sm" />
              {stats.username} • Refresh every 24h • Source: {formatSource(stats.source)} • Updated{" "}
              {new Date(stats.fetchedAt).toLocaleString("en-US")}
            </small>
          </div>
        </>
      ) : null}
    </motion.section>
  );
}
