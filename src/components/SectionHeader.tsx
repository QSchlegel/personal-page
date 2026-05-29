"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { easingStandard } from "@/lib/motion";

interface SectionHeaderProps {
  index: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
}

/**
 * Numbered, CV-style section header: a mono "01 / EYEBROW" label, the heading,
 * and a rust "ink underline" that draws in on scroll. Reduced-motion shows the
 * underline fully drawn.
 */
export function SectionHeader({ index, eyebrow, title, children }: SectionHeaderProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="section-heading">
      <p className="eyebrow">
        <span className="section-number">{index}</span> / {eyebrow}
      </p>
      <h2>{title}</h2>
      <motion.span
        className="heading-underline"
        aria-hidden
        initial={reduceMotion ? false : { scaleX: 0 }}
        whileInView={reduceMotion ? undefined : { scaleX: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.55, ease: easingStandard }}
      />
      {children}
    </div>
  );
}
