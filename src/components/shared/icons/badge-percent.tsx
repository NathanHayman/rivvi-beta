"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const pathVariants: Variants = {
  normal: {
    rotate: 0,
    transition: {
      type: "spring",
      stiffness: 60,
      damping: 10,
      duration: 0.5,
    },
  },
  animate: {
    rotate: 180,
    transition: {
      delay: 0.1,
      type: "spring",
      stiffness: 80,
      damping: 13,
    },
  },
};

const BadgePercentIcon = createAnimatedIcon({
  paths: (controls) => (
    <>
      <motion.path
        variants={pathVariants}
        animate={controls}
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
      />
      <path d="m15 9-6 6" />
      <path d="M9 9h.01" />
      <path d="M15 15h.01" />
    </>
  ),
});

export { BadgePercentIcon };
