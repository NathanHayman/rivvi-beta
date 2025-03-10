"use client";

import { Logo } from "@/components/shared/logos/rivvi-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrganizationList } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { ArrowUpRight, Building } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OrganizationSelector() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirectUrl") ?? "/";

  return (
    <OrganizationList
      hidePersonal={true}
      afterCreateOrganizationUrl={redirectUrl}
      afterSelectOrganizationUrl={redirectUrl}
      appearance={{
        elements: {
          rootBox: "w-full p-0",
          card: "shadow-none border-0 p-0",
          cardBox: "shadow-none border-0 p-0",
          organizationSwitcherTrigger:
            "rounded-lg border border-zinc-200 hover:border-zinc-300 shadow-sm",
          organizationPreviewTextContainer: "font-medium",
          organizationPreviewMainIdentifier: "text-foreground",
          organizationPreviewSecondaryIdentifier: "text-muted-foreground",
          organizationPreview: "hover:bg-zinc-50 rounded-lg transition-colors",
          organizationPreviewAvatarContainer: "opacity-90",
          createOrganizationButton:
            "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white py-2",
          badge: "bg-indigo-50 text-indigo-700 border-indigo-100",
          organizationSwitcherPopoverCard:
            "shadow-xl rounded-xl border border-zinc-200",
          organizationSwitcherPopoverActionButton:
            "hover:bg-zinc-50 text-indigo-600 hover:text-indigo-700",
          organizationSwitcherPopoverActionButtonIcon: "text-indigo-600",
          organizationSwitcherPopoverActionButtonText:
            "text-indigo-600 font-medium",
          organizationSwitcherPopoverFooter: "border-t border-zinc-200",
        },
      }}
    />
  );
}

export default function OrganizationSelection() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Left side - Form */}
      <div className="flex w-full items-center justify-center bg-white p-8 md:w-1/2 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="mb-6 space-y-2">
            <div className="flex items-center gap-2">
              <Logo variant="mark" markClassName="h-10 w-auto" />
              <Logo
                variant="type"
                typeClassName="text-2xl font-bold text-foreground"
              />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Select an organization
            </h2>
            <p className="text-muted-foreground">
              Choose your organization to access the healthcare voice AI
              platform
            </p>
          </div>

          <Card className="overflow-hidden rounded-xl border-border shadow-sm">
            <CardHeader className="border-b border-border bg-zinc-50/80 pb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-indigo-100/70 p-2">
                  <Building className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    Your Organizations
                  </CardTitle>
                  <CardDescription>
                    Select or create an organization
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                  </div>
                }
              >
                <OrganizationSelector />
              </Suspense>
            </CardContent>
            <CardFooter className="flex items-center border-t border-border bg-zinc-50/80">
              <p className="text-sm text-muted-foreground">
                Can't find your organization? Contact your administrator for an
                invitation.
              </p>
            </CardFooter>
          </Card>

          <div className="relative">
            <span className="block h-px w-full bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"></span>
            <span className="mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent blur-sm"></span>
          </div>

          <motion.div whileHover={{ y: -2 }} className="group text-center">
            <a
              href="mailto:support@rivvi.ai"
              className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Need help accessing your organization?
              <ArrowUpRight className="ml-1 h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </motion.div>
        </motion.div>
      </div>

      {/* Right side - Illustration with gradient background */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#5955F4] via-[#7D5BF6] to-[#A45CFF] md:block md:w-1/2">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='%23ffffff20'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e")`,
          }}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute inset-0 bg-[url('/placeholder.jpeg')] bg-cover bg-center opacity-10"
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-md text-center"
          >
            <div className="mb-8 flex justify-center">
              <Logo
                variant="mark"
                markClassName="h-24 w-auto opacity-90"
                markTheme="light"
              />
            </div>
            <h2 className="mb-4 text-3xl font-bold text-white">
              Unified Organization Management
            </h2>
            <p className="mb-8 text-lg text-white/80">
              Access your organization's customized settings, campaigns, and
              analytics with our powerful multi-tenant platform.
            </p>
            <div className="flex flex-col items-center rounded-xl bg-white/10 p-6 backdrop-blur-sm">
              <div className="mb-2 text-sm font-medium uppercase tracking-wider text-white/90">
                Enterprise Features
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Pill>Dedicated Campaigns</Pill>
                <Pill>Custom Voice Models</Pill>
                <Pill>Role-Based Access</Pill>
                <Pill>Analytics Dashboard</Pill>
                <Pill>Patient Management</Pill>
                <Pill>Unified Reporting</Pill>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
      {children}
    </div>
  );
}
