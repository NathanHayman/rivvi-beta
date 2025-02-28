'use client';

import type { Transition } from 'motion/react';
import { motion, useAnimation } from 'motion/react';

const defaultTransition: Transition = {
  type: 'spring',
  stiffness: 250,
  damping: 25,
};

const ChevronsDownUpIcon = () => {
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
          variants={{
            normal: { translateY: '0%' },
            animate: { translateY: '-2px' },
          }}
          transition={defaultTransition}
          animate={controls}
          initial="normal"
          d="m7 20 5-5 5 5"
        />
        <motion.path
          variants={{
            normal: { translateY: '0%' },
            animate: { translateY: '2px' },
          }}
          transition={defaultTransition}
          animate={controls}
          initial="normal"
          d="m7 4 5 5 5-5"
        />
      </svg>
    </div>
  );
};

export { ChevronsDownUpIcon };
