"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const svgVariants: Variants = {
  animate: {
    x: 0,
    y: 0,
    translateX: [0, 2, 0],
    transition: {
      duration: 0.5,
    },
  },
};

const pathVariants: Variants = {
  normal: {
    opacity: 1,
    pathLength: 1,
    transition: {
      duration: 0.4,
      opacity: { duration: 0.1 },
    },
  },
  animate: {
    opacity: [0, 1],
    pathLength: [0, 1],
    pathOffset: [1, 0],
    transition: {
      duration: 0.4,
      opacity: { duration: 0.1 },
    },
  },
};

const arrowVariants: Variants = {
  normal: {
    opacity: 1,
    pathLength: 1,
    transition: {
      delay: 0.3,
      duration: 0.3,
      opacity: { duration: 0.1, delay: 0.3 },
    },
  },
  animate: {
    opacity: [0, 1],
    pathLength: [0, 1],
    pathOffset: [0.5, 0],
    transition: {
      delay: 0.3,
      duration: 0.3,
      opacity: { duration: 0.1, delay: 0.3 },
    },
  },
};

const TrendingUpDownIcon = createAnimatedIcon({
  svgVariants: svgVariants,
  paths: (controls) => (
    <>
      <motion.path
        d="M21 21 14.828 14.828"
        variants={pathVariants}
        initial="normal"
        animate={controls}
      />
      <motion.path
        d="M21 16v5h-5"
        variants={arrowVariants}
        initial="normal"
        animate={controls}
      />
      <motion.path
        d="m21 3-9 9-4-4-6 6"
        variants={pathVariants}
        initial="normal"
        animate={controls}
      />
      <motion.path
        d="M21 8V3h-5"
        variants={arrowVariants}
        initial="normal"
        animate={controls}
      />
    </>
  ),
});

export { TrendingUpDownIcon };
