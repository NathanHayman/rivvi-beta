"use client";

import { motion } from "motion/react";
import { createAnimatedIcon } from "./animated-icon";

const AudioLinesIcon = createAnimatedIcon({
  paths: (controls) => (
    <>
      <path d="M2 10v3" />
      <motion.path
        variants={{
          normal: { d: "M6 6v11" },
          animate: {
            d: ["M6 6v11", "M6 10v3", "M6 6v11"],
            transition: {
              duration: 1.5,
              repeat: Infinity,
            },
          },
        }}
        d="M6 6v11"
        animate={controls}
      />
      <motion.path
        variants={{
          normal: { d: "M10 3v18" },
          animate: {
            d: ["M10 3v18", "M10 9v5", "M10 3v18"],
            transition: {
              duration: 1,
              repeat: Infinity,
            },
          },
        }}
        d="M10 3v18"
        animate={controls}
      />
      <motion.path
        variants={{
          normal: { d: "M14 8v7" },
          animate: {
            d: ["M14 8v7", "M14 6v11", "M14 8v7"],
            transition: {
              duration: 0.8,
              repeat: Infinity,
            },
          },
        }}
        d="M14 8v7"
        animate={controls}
      />
      <motion.path
        variants={{
          normal: { d: "M18 5v13" },
          animate: {
            d: ["M18 5v13", "M18 7v9", "M18 5v13"],
            transition: {
              duration: 1.5,
              repeat: Infinity,
            },
          },
        }}
        d="M18 5v13"
        animate={controls}
      />
      <path d="M22 10v3" />
    </>
  ),
});

export { AudioLinesIcon };
