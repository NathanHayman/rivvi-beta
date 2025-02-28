"use client";

import type { Variants } from "motion/react";
import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const variants: Variants = {
  normal: { rotate: 0 },
  animate: { rotate: [0, -10, 10, -10, 0] },
};

const CircleHelpIcon = createAnimatedIcon({
  variants: variants,
  paths: (controls) => (
    <>
      <circle cx="12" cy="12" r="10" />
      <motion.g
        variants={variants}
        transition={{
          duration: 0.5,
          ease: "easeInOut",
        }}
        animate={controls}
      >
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </motion.g>
    </>
  ),
});

export { CircleHelpIcon };
