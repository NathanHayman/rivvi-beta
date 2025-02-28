import { cn } from "@/lib/utils";
import { useAnimation } from "motion/react";

interface IconWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  controls: ReturnType<typeof useAnimation>;
  wrapperClassName?: string;
}

export const IconWrapper = ({
  children,
  controls,
  wrapperClassName,
  ...props
}: IconWrapperProps) => {
  return (
    <div
      className={cn(
        "cursor-pointer select-none p-2 hover:bg-accent rounded-md transition-colors duration-200 flex items-center justify-start gap-2 w-full",
        wrapperClassName
      )}
      onMouseEnter={() => controls.start("animate")}
      onMouseLeave={() => controls.start("normal")}
      {...props}
    >
      {children}
    </div>
  );
};
