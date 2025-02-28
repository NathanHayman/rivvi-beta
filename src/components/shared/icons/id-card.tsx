'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';

const Variants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: (custom: number) => ({
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.3,
      delay: custom * 0.1,
    },
  }),
};

const IdCardIcon = () => {
  const controls = useAnimation();

  return (
    <div
      className="cursor-pointer select-none p-2 hover:bg-accent rounded-md transition-colors duration-200 flex items-center justify-center"
      onMouseEnter={() => controls.start('animate')}
      onMouseLeave={() => controls.start('normal')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M16 10h2"
          variants={Variants}
          animate={controls}
          custom={2}
        />
        <motion.path
          d="M16 14h2"
          variants={Variants}
          animate={controls}
          custom={2}
        />
        <motion.path
          d="M6.17 15a3 3 0 0 1 5.66 0"
          variants={Variants}
          animate={controls}
          custom={0}
        />
        <motion.circle
          cx="9"
          cy="11"
          r="2"
          variants={Variants}
          animate={controls}
          custom={1}
        />
        <rect x="2" y="5" width="20" height="14" rx="2" />
      </svg>
    </div>
  );
};

export { IdCardIcon };
