"use client";

import { createAnimatedIcon } from "./animated-icon";

const RefreshIcon = createAnimatedIcon({
  svgVariants: {
    normal: {
      rotate: "0deg",
    },
    animate: {
      rotate: "-50deg",
    },
  },
  transition: {
    type: "spring",
    stiffness: 250,
    damping: 25,
  },
  paths: () => (
    <>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </>
  ),
});

export { RefreshIcon };
