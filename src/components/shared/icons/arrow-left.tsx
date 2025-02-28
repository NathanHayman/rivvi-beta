"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const pathVariants: Variants = {
  normal: { d: "m12 19-7-7 7-7", translateX: 0 },
  animate: {
    d: "m12 19-7-7 7-7",
    translateX: [0, 3, 0],
    transition: {
      duration: 0.4,
    },
  },
};

const secondPathVariants: Variants = {
  normal: { d: "M19 12H5" },
  animate: {
    d: ["M19 12H5", "M19 12H10", "M19 12H5"],
    transition: {
      duration: 0.4,
    },
  },
};

const ArrowLeftIcon = createAnimatedIcon({
  paths: (controls) => (
    <>
      <motion.path
        d="m12 19-7-7 7-7"
        variants={pathVariants}
        animate={controls}
      />
      <motion.path
        d="M19 12H5"
        variants={secondPathVariants}
        animate={controls}
      />
    </>
  ),
});

export { ArrowLeftIcon };
