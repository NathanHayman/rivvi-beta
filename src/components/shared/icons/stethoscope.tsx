"use client";

import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const DURATION = 0.25;

const calculateDelay = (i: number) => {
  return i === 0 ? 0.1 : i * DURATION + 0.1;
};

const StethoscopeIcon = createAnimatedIcon({
  paths: (controls) => (
    <>
      <motion.path
        d="M11 2v2"
        animate={controls}
        transition={{
          duration: DURATION,
          delay: calculateDelay(2),
          opacity: { delay: calculateDelay(2) },
        }}
        variants={{
          normal: {
            pathLength: 1,
            pathOffset: 0,
            opacity: 1,
            transition: { delay: 0 },
          },
          animate: {
            pathOffset: [1, 0],
            pathLength: [0, 1],
            opacity: [0, 1],
          },
        }}
      />
      <motion.path
        d="M5 2v2"
        animate={controls}
        transition={{
          duration: DURATION,
          delay: calculateDelay(2),
          opacity: { delay: calculateDelay(2) },
        }}
        variants={{
          normal: {
            pathLength: 1,
            pathOffset: 0,
            opacity: 1,
            transition: { delay: 0 },
          },
          animate: {
            pathOffset: [1, 0],
            pathLength: [0, 1],
            opacity: [0, 1],
          },
        }}
      />
      <motion.path
        d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"
        animate={controls}
        transition={{
          duration: DURATION,
          delay: calculateDelay(2),
          opacity: { delay: calculateDelay(2) },
        }}
        variants={{
          normal: {
            pathLength: 1,
            pathOffset: 0,
            opacity: 1,
            transition: { delay: 0 },
          },
          animate: {
            pathLength: [0, 1],
            pathOffset: [1, 0],
            opacity: [0, 1],
          },
        }}
      />
      <motion.path
        d="M8 15a6 6 0 0 0 12 0v-3"
        animate={controls}
        transition={{
          duration: DURATION,
          delay: calculateDelay(1),
          opacity: { delay: calculateDelay(1) },
        }}
        variants={{
          normal: {
            pathLength: 1,
            pathOffset: 0,
            opacity: 1,
            transition: { delay: 0 },
          },
          animate: {
            pathOffset: [1, 0],
            pathLength: [0, 1],
            opacity: [0, 1],
          },
        }}
      />
      <motion.circle
        cx="20"
        cy="10"
        r="2"
        animate={controls}
        transition={{
          duration: DURATION,
          delay: calculateDelay(0),
          opacity: { delay: calculateDelay(0) },
        }}
        variants={{
          normal: { pathLength: 1, opacity: 1, transition: { delay: 0 } },
          animate: {
            pathLength: [0, 1],
            opacity: [0, 1],
          },
        }}
      />
    </>
  ),
});

export { StethoscopeIcon };
