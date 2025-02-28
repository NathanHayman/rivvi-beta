"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & {
    digest?: string;
    data?: { code?: string; message?: string };
  };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);

    // Check if it's an authentication error
    const isTRPCError =
      error.message.includes("TRPC") ||
      (error.data && typeof error.data === "object");

    const isAuthError =
      error.data?.code === "UNAUTHORIZED" ||
      error.data?.code === "FORBIDDEN" ||
      error.message.includes("You must be logged in") ||
      error.message.includes("You must be part of an organization");

    // Redirect to login for auth errors
    if (isTRPCError && isAuthError) {
      router.push("/login");
    }
  }, [error, router]);

  return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Something went wrong!
        </h2>
        <p className="mt-2 text-muted-foreground">
          {error.message || "An unexpected error occurred"}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => router.push("/")}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
