"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const pathVariants: Variants = {
  normal: {
    translateX: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 13,
    },
  },
  animate: {
    translateX: [-6, 0],
    transition: {
      delay: 0.1,
      type: "spring",
      stiffness: 200,
      damping: 13,
    },
  },
};

const UsersIcon = createAnimatedIcon({
  variants: pathVariants,
  paths: (controls) => (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <motion.path
        d="M22 21v-2a4 4 0 0 0-3-3.87"
        variants={pathVariants}
        animate={controls}
      />
      <motion.path
        d="M16 3.13a4 4 0 0 1 0 7.75"
        variants={pathVariants}
        animate={controls}
      />
    </>
  ),
});

export { UsersIcon };
