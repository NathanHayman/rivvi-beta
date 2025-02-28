'use client';

import { motion, useAnimation } from 'motion/react';

const CompassIcon = () => {
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
        <motion.polygon
          points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
          variants={{
            normal: {
              rotate: 0,
            },
            animate: {
              rotate: 360,
            },
          }}
          transition={{
            type: 'spring',
            stiffness: 120,
            damping: 15,
          }}
          animate={controls}
        />
      </svg>
    </div>
  );
};

export { CompassIcon };
