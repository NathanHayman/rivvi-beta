"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const svgVariants: Variants = {
  animate: {
    x: 0,
    y: 0,
    translateX: [0, 2, 0],
    translateY: [0, -2, 0],
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

const TrendingUpIcon = createAnimatedIcon({
  svgVariants: svgVariants,
  variants: pathVariants,
  paths: (controls) => (
    <>
      <motion.polyline
        points="22 7 13.5 15.5 8.5 10.5 2 17"
        variants={pathVariants}
        initial="normal"
        animate={controls}
      />
      <motion.polyline
        points="16 7 22 7 22 13"
        variants={arrowVariants}
        initial="normal"
        animate={controls}
      />
    </>
  ),
});

export { TrendingUpIcon };
