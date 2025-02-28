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
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
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
