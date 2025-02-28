'use client';

import type { Transition } from 'motion/react';
import { motion, useAnimation } from 'motion/react';

const defaultTransition: Transition = {
  times: [0, 0.4, 1],
  duration: 0.5,
};

const CircleChevronLeftIcon = () => {
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
        <circle cx="12" cy="12" r="10" />
        <motion.path
          variants={{
            normal: { x: 0 },
            animate: { x: [0, -2, 0] },
          }}
          transition={defaultTransition}
          animate={controls}
          d="m14 16-4-4 4-4"
        />
      </svg>
    </div>
  );
};

export { CircleChevronLeftIcon };
