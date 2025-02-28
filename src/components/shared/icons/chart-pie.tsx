"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const pathVariants: Variants = {
  normal: { translateX: 0, translateY: 0 },
  animate: { translateX: 1.1, translateY: -1.1 },
};

const ChartPieIcon = createAnimatedIcon({
  paths: (controls) => (
    <>
      <motion.path
        d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"
        transition={{
          type: "spring",
          stiffness: 250,
          damping: 15,
          bounce: 0.6,
        }}
        variants={pathVariants}
        animate={controls}
      />
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
    </>
  ),
});

export { ChartPieIcon };
