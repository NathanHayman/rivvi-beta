"use client";

import type { Variants } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const iconVariants: Variants = {
  normal: {
    scale: 1,
    rotate: 0,
  },
  animate: {
    scale: 1.05,
    rotate: [0, -7, 7, 0],
    transition: {
      rotate: {
        duration: 0.5,
        ease: "easeInOut",
      },
      scale: {
        type: "spring",
        stiffness: 400,
        damping: 10,
      },
    },
  },
};

const MessageCircleIcon = createAnimatedIcon({
  svgVariants: iconVariants,
  paths: () => <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
});

export { MessageCircleIcon };
