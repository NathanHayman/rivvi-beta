"use client";

import { Button } from "@/components/ui/button";
import {
  OrganizationSwitcher as ClerkOrgSwitcher,
  UserButton as ClerkUserButton,
} from "@clerk/nextjs";
import { type ReactNode } from "react";

export function UserButton() {
  return <ClerkUserButton />;
}

export function ClientFallback() {
  return (
    <Button variant="outline">
      <UserButton />
    </Button>
  );
}

export function OrganizationSwitcher({
  fallback,
  appearance,
  hidePersonal,
}: {
  fallback?: ReactNode;
  appearance?: Record<string, any>;
  hidePersonal?: boolean;
}) {
  return (
    <ClerkOrgSwitcher
      fallback={<ClientFallback />}
      appearance={appearance}
      hidePersonal={hidePersonal}
    />
  );
}
