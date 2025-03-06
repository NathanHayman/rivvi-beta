import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        success_outline: "text-emerald-700 dark:text-emerald-500 ",
        success_solid:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-500",
        success_solid_outline:
          "bg-emerald-100 text-emerald-800 ring-emerald-600/10 dark:bg-emerald-400/20 dark:text-emerald-500 dark:ring-emerald-400/20 border-emerald-600/10",
        failure_outline: "text-red-700 dark:text-red-500",
        failure_solid:
          "bg-red-100 text-red-800 dark:bg-red-400/20 dark:text-red-500",
        neutral_outline: "text-zinc-700 dark:text-zinc-500 ",
        neutral_solid:
          "bg-zinc-200/50 text-zinc-700 dark:bg-zinc-500/30 dark:text-zinc-400 border-zinc-200 dark:border-zinc-500/20",
        blue_outline: "text-blue-700 dark:text-blue-500",
        blue_solid:
          "bg-blue-100 text-blue-800 dark:bg-blue-400/20 dark:text-blue-500",
        blue_solid_outline:
          "bg-blue-100 text-blue-800 ring-blue-600/10 dark:bg-blue-400/20 dark:text-blue-500 dark:ring-blue-400/20 border-blue-600/10",
        violet_outline: "text-violet-700 dark:text-violet-500",
        violet_solid:
          "bg-violet-100 text-violet-800 dark:bg-violet-400/20 dark:text-violet-500",
        violet_solid_outline:
          "bg-violet-100 text-violet-800 ring-violet-600/10 dark:bg-violet-400/20 dark:text-violet-500 dark:ring-violet-400/20 border-violet-600/10",
        yellow_outline: "text-yellow-700 dark:text-yellow-500",
        yellow_solid:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-400/20 dark:text-yellow-500",
        yellow_solid_outline:
          "bg-yellow-100 text-yellow-800 ring-yellow-600/10 dark:bg-yellow-400/20 dark:text-yellow-500 dark:ring-yellow-400/20 border-yellow-600/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
