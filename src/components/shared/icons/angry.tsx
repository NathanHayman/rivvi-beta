"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const EYEBROW_ROTATION = 20;
const DURATION = 0.6;

const pathVariantsFace: Variants = {
  normal: { scale: 1, rotate: 0 },
  animate: {
    scale: [1, 1.2, 1.2, 1.2, 1],
    rotate: [0, -3, 3, -1, 1, 0],
    transition: {
      duration: DURATION,
      times: [0, 0.2, 0.4, 0.6, 1],
      ease: "easeInOut",
    },
  },
};

const pathVariantsLeftEyebrow: Variants = {
  normal: { rotate: 0 },
  animate: {
    rotate: [0, EYEBROW_ROTATION, 0],
    transition: {
      duration: DURATION + 0.2,
    },
  },
};

const pathVariantsRightEyebrow: Variants = {
  normal: { rotate: 0 },
  animate: {
    rotate: [0, -EYEBROW_ROTATION, 0],
    transition: {
      duration: DURATION + 0.2,
    },
  },
};

const pathVariantsEye: Variants = {
  normal: { scale: 1 },
  animate: {
    scale: [1, 1.2, 1],
    transition: {
      duration: DURATION,
    },
  },
};

const pathVariantsMouth: Variants = {
  normal: { translateY: 0 },
  animate: {
    translateY: [0, -0.5, 0],
    transition: {
      duration: DURATION,
    },
  },
};

const AngryIcon = createAnimatedIcon({
  svgVariants: pathVariantsFace,
  paths: (controls) => (
    <>
      <circle cx="12" cy="12" r="10" />
      <motion.path
        variants={pathVariantsMouth}
        animate={controls}
        d="M16 16s-1.5-2-4-2-4 2-4 2"
      />
      <motion.path
        variants={pathVariantsLeftEyebrow}
        animate={controls}
        d="M7.5 8 10 9"
      />
      <motion.path
        variants={pathVariantsRightEyebrow}
        animate={controls}
        d="m14 9 2.5-1"
      />
      <motion.path
        variants={pathVariantsEye}
        animate={controls}
        d="M9 10h.01"
      />
      <motion.path
        variants={pathVariantsEye}
        animate={controls}
        d="M15 10h.01"
      />
    </>
  ),
});

export { AngryIcon };
