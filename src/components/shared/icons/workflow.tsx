"use client";

import type { Transition, Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const transition: Transition = {
  duration: 0.3,
  opacity: { delay: 0.15 },
};

const variants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: (custom: number) => ({
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      ...transition,
      delay: 0.1 * custom,
    },
  }),
};

const WorkflowIcon = createAnimatedIcon({
  variants: variants,
  paths: (controls) => (
    <>
      <motion.rect
        width="8"
        height="8"
        x="3"
        y="3"
        rx="2"
        variants={variants}
        animate={controls}
        custom={0}
      />
      <motion.path
        d="M7 11v4a2 2 0 0 0 2 2h4"
        variants={variants}
        animate={controls}
        custom={3}
      />
      <motion.rect
        width="8"
        height="8"
        x="13"
        y="13"
        rx="2"
        variants={variants}
        animate={controls}
        custom={0}
      />
    </>
  ),
});

export { WorkflowIcon };
