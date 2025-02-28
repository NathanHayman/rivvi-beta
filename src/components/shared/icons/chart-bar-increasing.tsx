"use client";

import { type Variants, motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const frameVariants: Variants = {
  visible: { opacity: 1 },
  hidden: { opacity: 1 },
};

const lineVariants: Variants = {
  visible: { pathLength: 1, opacity: 1 },
  hidden: { pathLength: 0, opacity: 0 },
};

const ChartBarIncreasingIcon = createAnimatedIcon({
  onMouseEnter: async (controls) => {
    await controls.start((i) => ({
      pathLength: 0,
      opacity: 0,
      transition: { delay: i * 0.1, duration: 0.3 },
    }));
    await controls.start((i) => ({
      pathLength: 1,
      opacity: 1,
      transition: { delay: i * 0.1, duration: 0.3 },
    }));
  },
  onMouseLeave: (controls) => {
    controls.start("visible");
  },
  paths: (controls) => (
    <>
      <motion.path variants={frameVariants} d="M3 3v16a2 2 0 0 0 2 2h16" />
      <motion.path
        variants={lineVariants}
        initial="visible"
        animate={controls}
        custom={1}
        d="M7 11h8"
      />
      <motion.path
        variants={lineVariants}
        initial="visible"
        animate={controls}
        custom={2}
        d="M7 16h12"
      />
      <motion.path
        variants={lineVariants}
        initial="visible"
        animate={controls}
        custom={1}
        d="M7 6h3"
      />
    </>
  ),
});

export { ChartBarIncreasingIcon };
