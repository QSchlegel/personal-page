"use client";

import { useEffect, useState } from "react";
import { Calendar, FolderGit2, Github, Star, Trophy } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { cardReveal, sectionReveal, staggerContainer } from "@/lib/motion";
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

function formatMetric(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
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
      <div className="section-heading">
        <h2>GitHub Stats</h2>
        <p>A quick snapshot of public repository output and activity.</p>
      </div>

      {error ? <p className="status-error">{error}</p> : null}
      {!stats && !error ? <p className="status-muted">Loading stats...</p> : null}

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
              <strong>{formatMetric(stats.repoCount)}</strong>
            </motion.article>

            <motion.article className="stats-card" variants={cardReveal} custom={1}>
              <p className="stats-label">
                <Star className="icon-sm" />
                Total Stars
              </p>
              <strong>{formatMetric(stats.totalStars)}</strong>
            </motion.article>

            <motion.article className="stats-card" variants={cardReveal} custom={2}>
              <p className="stats-label">
                <Trophy className="icon-sm" />
                Featured Repos
              </p>
              <strong>{formatMetric(stats.featuredCount)}</strong>
            </motion.article>

            <motion.article className="stats-card" variants={cardReveal} custom={3}>
              <p className="stats-label">
                <Calendar className="icon-sm" />
                Latest Push
              </p>
              <strong>{formatLatestPush(stats.latestPushAt)}</strong>
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
