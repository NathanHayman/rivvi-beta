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
        "flex flex-1 flex-col gap-4 p-4 sm:p-6 max-w-screen-xl w-full mx-auto",
        maxWidth,
        className
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
          "lg:flex lg:items-center lg:justify-between py-4 relative",
          className
        )}
      >
        <div className="min-w-0 flex-1">
          {title && (
            <h1 className="text-2xl tracking-tight leading-7 sm:truncate font-bold">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm sm:text-base mt-2 text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className="mt-5 flex lg:ml-4 lg:mt-0 gap-2">
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
  return <div className={cn("flex-1 w-full", className)}>{children}</div>;
};

const AppBreadcrumbs: React.FC<{
  breadcrumbs: {
    title: string;
    href: string;
  }[];
  children?: React.ReactNode;
}> = ({ breadcrumbs, children }) => {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 justify-between">
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

export { AppBody, AppBreadcrumbs, AppContent, AppHeader, AppPage };
