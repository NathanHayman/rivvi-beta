"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const variants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: (custom: number) => ({
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      delay: 0.15 * custom,
      opacity: { delay: 0.1 * custom },
    },
  }),
};

const WaypointsIcon = createAnimatedIcon({
  variants: variants,
  paths: (controls) => (
    <>
      <motion.circle
        cx="12"
        cy="4.5"
        r="2.5"
        variants={variants}
        animate={controls}
        custom={0}
      />
      <motion.path
        d="m10.2 6.3-3.9 3.9"
        variants={variants}
        animate={controls}
        custom={1}
      />
      <motion.circle
        cx="4.5"
        cy="12"
        r="2.5"
        variants={variants}
        animate={controls}
        custom={0}
      />
      <motion.path
        d="M7 12h10"
        variants={variants}
        animate={controls}
        custom={2}
      />
      <motion.circle
        cx="19.5"
        cy="12"
        r="2.5"
        variants={variants}
        animate={controls}
        custom={0}
      />
      <motion.path
        d="m13.8 17.7 3.9-3.9"
        variants={variants}
        animate={controls}
        custom={3}
      />
      <motion.circle
        cx="12"
        cy="19.5"
        r="2.5"
        variants={variants}
        animate={controls}
        custom={0}
      />
    </>
  ),
});

export { WaypointsIcon };
