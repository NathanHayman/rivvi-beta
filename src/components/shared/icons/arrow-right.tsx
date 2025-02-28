"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const pathVariants: Variants = {
  normal: { d: "M5 12h14" },
  animate: {
    d: ["M5 12h14", "M5 12h9", "M5 12h14"],
    transition: {
      duration: 0.4,
    },
  },
};

const secondaryPathVariants: Variants = {
  normal: { d: "m12 5 7 7-7 7", translateX: 0 },
  animate: {
    d: "m12 5 7 7-7 7",
    translateX: [0, -3, 0],
    transition: {
      duration: 0.4,
    },
  },
};

const ArrowRightIcon = createAnimatedIcon({
  paths: (controls) => (
    <>
      <motion.path d="M5 12h14" variants={pathVariants} animate={controls} />
      <motion.path
        d="m12 5 7 7-7 7"
        variants={secondaryPathVariants}
        animate={controls}
      />
    </>
  ),
});

export { ArrowRightIcon };
