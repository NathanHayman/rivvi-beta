"use client";

import { Logo_1 } from "@/components/shared/logos/logo";
import { SignIn } from "@clerk/nextjs";
import { motion } from "framer-motion";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Left side - Form */}
      <div className="bg-rivvi-light-100 dark:bg-rivvi-dark-700 flex w-full items-center justify-center p-8 md:w-1/2 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="mb-6 space-y-8">
            <div className="flex items-center gap-2">
              <Logo_1 variant="box" className="h-14 w-auto" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Welcome back
              </h2>
              <p className="text-muted-foreground">
                Sign in to access your healthcare voice AI platform
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <SignIn
              waitlistUrl="/waitlist"
              appearance={{
                elements: {
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  card: "shadow-none border-0 p-4 w-full rounded-none bg-card dark:bg-secondary/80",
                  cardBox: "shadow-none border-0 w-full",
                  rootBox: "w-full",
                  formButtonPrimary:
                    "bg-gradient-to-r from-rivvi-purple-500 to-rivvi-purple-600 hover:from-rivvi-purple-600 hover:to-rivvi-purple-700 text-white relative group py-3",
                  formButtonPrimaryIcon:
                    "mr-2 group-hover:translate-x-1 transition-transform",
                  footer:
                    "bg-rivvi-light-100 dark:bg-rivvi-dark-700 text-rivvi-light-500 dark:text-rivvi-light-400",
                  footerItem: "",
                  footerAction:
                    "text-rivvi-purple-600 hover:text-rivvi-purple-700",
                  formField: "rounded-lg",
                  formFieldLabel:
                    "text-rivvi-light-900 dark:text-rivvi-light-400",
                  formFieldInput:
                    "rounded-lg border-rivvi-light-200 focus:border-rivvi-purple-500 focus:ring-rivvi-purple-200",
                  identityPreview:
                    "border border-rivvi-light-400 rounded-lg shadow-sm",
                  formButtonReset:
                    "text-rivvi-purple-600 hover:text-rivvi-purple-700",
                  dividerLine: "bg-rivvi-light-400 dark:bg-rivvi-dark-800",
                  dividerText:
                    "text-rivvi-light-800 bg-white dark:bg-transparent",
                  socialButtonsIconButton:
                    "border-rivvi-light-400 hover:bg-rivvi-light-50 bg-rivvi-light-200 dark:bg-rivvi-dark-800",
                  socialButtonsBlockButton:
                    "border-rivvi-light-200 hover:bg-rivvi-light-50 bg-rivvi-light-200 dark:bg-rivvi-dark-800",
                  alert: "bg-red-50 border-red-100 text-red-600",
                },
                layout: {
                  termsPageUrl: "https://rivvi.ai/legal/terms",
                  privacyPageUrl: "https://rivvi.ai/legal/privacy",
                  socialButtonsPlacement: "top",
                  socialButtonsVariant: "iconButton",
                  showOptionalFields: false,
                },
                variables: {
                  colorPrimary: "#5955F4",
                  colorText: "#09090B",
                  colorBackground: "#ffffff",
                  colorInputText: "#09090B",
                  colorInputBackground: "#ffffff",
                  borderRadius: "0.75rem",
                },
              }}
            />
          </div>

          <div className="relative">
            <span className="block h-px w-full bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"></span>
            <span className="mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent blur-sm"></span>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Need help?{" "}
            <a
              href="mailto:support@rivvi.ai"
              className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Contact support
            </a>
          </p>
        </motion.div>
      </div>

      {/* Right side - Illustration with gradient background */}
      <div className="from-rivvi-purple-500 via-rivvi-purple-800 to-rivvi-purple-900 relative hidden overflow-hidden bg-gradient-to-tr md:block md:w-1/2">
        <div className="absolute inset-0 bg-dot-[#fff]/[0.20]" />

        <div className="absolute inset-0 flex flex-col items-center justify-center p-12">
          <Logo_1
            variant="mark"
            className="h-56 w-auto opacity-50"
            markTheme="dark"
          />
        </div>
      </div>
    </div>
  );
}
