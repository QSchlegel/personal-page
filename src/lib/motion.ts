import type { Variants } from "framer-motion";

export const easingStandard: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const springSoft = {
  type: "spring",
  stiffness: 220,
  damping: 24,
  mass: 0.7,
} as const;

export const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: easingStandard,
    },
  },
};

export const cardReveal: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      delay: index * 0.055,
      ease: easingStandard,
    },
  }),
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
};
