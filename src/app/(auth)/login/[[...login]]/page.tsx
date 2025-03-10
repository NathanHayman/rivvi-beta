"use client";

import { Logo } from "@/components/shared/logos/rivvi-logo";
import { SignIn } from "@clerk/nextjs";
import { motion } from "framer-motion";

export default function LoginPage() {
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
              Welcome back
            </h2>
            <p className="text-muted-foreground">
              Sign in to access your healthcare voice AI platform
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <SignIn
              waitlistUrl="/waitlist"
              appearance={{
                elements: {
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  card: "shadow-none border-0 p-0 w-full",
                  cardBox: "shadow-none border-0 w-full",
                  rootBox: "w-full",
                  formButtonPrimary:
                    "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white relative group",
                  formButtonPrimaryIcon:
                    "mr-2 group-hover:translate-x-1 transition-transform",
                  footerAction: "text-indigo-600 hover:text-indigo-700",
                  formField: "rounded-lg",
                  formFieldInput:
                    "rounded-lg border-zinc-200 focus:border-indigo-500 focus:ring-indigo-200",
                  identityPreview:
                    "border border-zinc-200 rounded-lg shadow-sm",
                  formButtonReset: "text-indigo-600 hover:text-indigo-700",
                  dividerLine: "bg-zinc-200",
                  dividerText: "text-zinc-500 bg-white",
                  socialButtonsIconButton: "border-zinc-200 hover:bg-zinc-50",
                  socialButtonsBlockButton: "border-zinc-200 hover:bg-zinc-50",
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
              Revolutionizing Healthcare Communication
            </h2>
            <p className="mb-8 text-lg text-white/80">
              Rivvi's AI-powered voice technology transforms patient care
              through natural, human-like conversational interactions.
            </p>
            <div className="flex justify-center space-x-4">
              <div className="flex flex-col items-center rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <div className="text-3xl font-bold text-white">99%</div>
                <div className="text-sm text-white/80">Accuracy Rate</div>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <div className="text-3xl font-bold text-white">500+</div>
                <div className="text-sm text-white/80">Healthcare Partners</div>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <div className="text-3xl font-bold text-white">24/7</div>
                <div className="text-sm text-white/80">Support</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
