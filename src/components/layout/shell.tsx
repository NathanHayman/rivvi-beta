import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import Link from "next/link";
import * as React from "react";
import { ReactNode } from "react";
import { ScrollArea } from "../ui/scroll-area";

const AppPage = ({ children }: { children: React.ReactNode }) => {
  return <React.Fragment>{children}</React.Fragment>;
};

const AppBody = ({
  children,
  className,
  maxWidth = "max-w-screen-xl",
}: {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}) => {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-4 p-4 sm:p-6",
        maxWidth,
        className,
      )}
    >
      {children}
    </div>
  );
};

const AppHeader = ({
  title,
  subtitle,
  buttons,
  className,
  border = true,
}: {
  title: string;
  subtitle?: string;
  buttons?: React.ReactNode | React.ReactNode[] | React.ReactNode[][];
  className?: string;
  border?: boolean;
}) => {
  return (
    <>
      <div
        className={cn(
          "relative py-4 lg:flex lg:items-center lg:justify-between",
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          {title && (
            <h1 className="text-2xl font-bold leading-7 tracking-tight sm:truncate">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
        <div className="mt-5 flex gap-2 lg:ml-4 lg:mt-0">
          {buttons && buttons}
        </div>
      </div>
    </>
  );
};

const AppContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <div className={cn("w-full flex-1", className)}>{children}</div>;
};

const AppBreadcrumbs: React.FC<{
  breadcrumbs: {
    title: string;
    href: string;
  }[];
  children?: React.ReactNode;
}> = ({ breadcrumbs, children }) => {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-2 px-4 sm:px-6">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((breadcrumb, idx) => (
              <React.Fragment key={breadcrumb.href}>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href={breadcrumb.href}
                    asChild
                    className="text-zinc-500 dark:text-zinc-400"
                  >
                    <Link prefetch={false} href={breadcrumb.href}>
                      {breadcrumb.title}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {idx < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="hidden md:block" />
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2 px-4 sm:px-6">{children}</div>
    </header>
  );
};
interface AppScrollAreaProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

const AppScrollArea = ({
  children,
  className,
  contentClassName,
}: AppScrollAreaProps) => {
  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </ScrollArea>
  );
};

export {
  AppBody,
  AppBreadcrumbs,
  AppContent,
  AppHeader,
  AppPage,
  AppScrollArea,
};
