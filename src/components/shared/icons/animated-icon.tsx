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
          "flex w-full cursor-pointer select-none items-center justify-center gap-2",
          "group-data-[collapsible=icon]:rounded-none group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-2",
          "group-data-[collapsible=icon]:gap-0",
          className,
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
            "transition-colors duration-300 ease-in-out",
            iconClassName,
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
