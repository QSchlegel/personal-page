"use client";

import { useEffect, useRef } from "react";

/**
 * The Secure Chat launcher rendered as a "living marble" — a Siri-like glass
 * orb (pure CSS: tumbling color swirls + tilting orbit bands + a glass
 * highlight). Ported from the dw-ai-support widget's embed launcher ("lebende
 * Murmel") and themed to the site's accent.
 *
 * The orb starts lively on mount and on hover, then exponentially settles to a
 * calm idle via the Web Animations API (playbackRate decay) — so it invites a
 * click without fidgeting forever. Respects prefers-reduced-motion.
 */
interface SecureChatMarbleProps {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  expanded?: boolean;
  label?: string;
}

export function SecureChatMarble({
  onClick,
  disabled,
  busy,
  expanded,
  label = "Secure Chat",
}: SecureChatMarbleProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const CALM = 0.45;
    const TAU = 12;
    let energy = 3;
    let timer: ReturnType<typeof setInterval> | 0 = 0;

    const apply = () => {
      for (const animation of btn.getAnimations({ subtree: true })) {
        animation.playbackRate = energy;
      }
      btn.classList.toggle("scm-calm", energy < 0.8);
    };
    const excite = (level: number) => {
      energy = Math.max(energy, level);
      apply();
      if (timer) return;
      timer = setInterval(() => {
        energy = CALM + (energy - CALM) * Math.exp(-0.16 / TAU);
        if (energy - CALM < 0.02) {
          energy = CALM;
          clearInterval(timer);
          timer = 0;
        }
        apply();
      }, 160);
    };

    // Defer one frame so the CSS animations exist before we rate-control them.
    const raf = requestAnimationFrame(() => excite(3));
    const onEnter = () => excite(1.7);
    btn.addEventListener("pointerenter", onEnter);

    return () => {
      cancelAnimationFrame(raf);
      btn.removeEventListener("pointerenter", onEnter);
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      className="scm-launch"
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-busy={busy}
      aria-label={busy ? "Securing…" : label}
      title={label}
    >
      <span className="scm-orb" aria-hidden="true">
        <span className="scm-s scm-s1" />
        <span className="scm-s scm-s2" />
        <span className="scm-s scm-s3" />
        <span className="scm-r scm-r1" />
        <span className="scm-r scm-r2" />
        <span className="scm-gl" />
      </span>
    </button>
  );
}
