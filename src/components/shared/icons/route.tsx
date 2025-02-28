"use client";

import type { Transition, Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const circleTransition: Transition = {
  duration: 0.3,
  delay: 0.1,
  opacity: { delay: 0.15 },
};

const circleVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
  },
};

const RouteIcon = createAnimatedIcon({
  svgVariants: {
    normal: {
      rotate: "0deg",
    },
    animate: {
      rotate: "-50deg",
    },
  },
  paths: (controls) => (
    <>
      <motion.circle
        cx="6"
        cy="19"
        r="3"
        transition={circleTransition}
        variants={circleVariants}
        animate={controls}
      />
      <motion.path
        d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"
        transition={{ duration: 0.7, delay: 0.5, opacity: { delay: 0.5 } }}
        variants={{
          normal: {
            pathLength: 1,
            opacity: 1,
            pathOffset: 0,
          },
          animate: {
            pathLength: [0, 1],
            opacity: [0, 1],
            pathOffset: [1, 0],
          },
        }}
        animate={controls}
      />
      <motion.circle
        cx="18"
        cy="5"
        r="3"
        transition={circleTransition}
        variants={circleVariants}
        animate={controls}
      />
    </>
  ),
});

export { RouteIcon };
