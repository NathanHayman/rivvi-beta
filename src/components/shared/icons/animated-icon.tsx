"use client";

import { cn } from "@/lib/utils";
import type { Transition, Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";

export interface AnimatedIconProps {
  className?: string;
  iconClassName?: string;
  children?: React.ReactNode;
  /** Optional click handler for the wrapper div */
  onClick?: () => void;
}

export interface CreateAnimatedIconOptions {
  variants?: Variants;
  width?: number;
  height?: number;
  viewBox?: string;
  svgVariants?: Variants;
  transition?: Transition;
  onMouseEnter?: (controls: ReturnType<typeof useAnimation>) => void;
  onMouseLeave?: (controls: ReturnType<typeof useAnimation>) => void;
  paths: (controls: ReturnType<typeof useAnimation>) => React.ReactNode;
}

export const createAnimatedIcon = ({
  transition,
  svgVariants,
  onMouseEnter,
  onMouseLeave,
  width = 24,
  height = 24,
  viewBox = "0 0 24 24",
  paths,
}: CreateAnimatedIconOptions) => {
  return function AnimatedIconComponent({
    className,
    iconClassName,
    children,
    onClick,
  }: AnimatedIconProps = {}) {
    const controls = useAnimation();

    return (
      <div
        className={cn(
          "cursor-pointer select-none hover:bg-zinc-200/20 dark:hover:bg-zinc-800 p-2.5 py-3.5 rounded-md transition-colors duration-300 ease-in-out flex items-center justify-start gap-2 w-full",
          "group-data-[collapsible=icon]:p-4 group-data-[collapsible=icon]:py-4 group-data-[collapsible=icon]:rounded-none group-data-[collapsible=icon]:hover:bg-transparent",
          className
        )}
        onClick={onClick}
        onMouseEnter={
          onMouseEnter
            ? () => onMouseEnter(controls)
            : () => controls.start("animate")
        }
        onMouseLeave={
          onMouseLeave
            ? () => onMouseLeave(controls)
            : () => controls.start("normal")
        }
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width={width}
          height={height}
          viewBox={viewBox}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "transition-colors duration-300 ease-in-out fill-zinc-500/10 dark:fill-zinc-200/10",
            iconClassName
          )}
          variants={svgVariants}
          animate={controls}
          transition={transition}
        >
          {paths(controls)}
        </motion.svg>
        {children}
      </div>
    );
  };
};
