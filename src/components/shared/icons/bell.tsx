"use client";

import type { Variants } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const svgVariants: Variants = {
  normal: { rotate: 0 },
  animate: { rotate: [0, -10, 10, -10, 0] },
};

const BellIcon = createAnimatedIcon({
  svgVariants,
  transition: {
    duration: 0.5,
    ease: "easeInOut",
  },
  paths: () => (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
});

export { BellIcon };
