import { Logo } from "@/components/shared/logos/rivvi-logo";
import { SignIn } from "@clerk/nextjs";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - Rivvi",
  description: "Login to Rivvi's human-like conversational AI for healthcare.",
};

export default function LoginPage() {
  return (
    <div className="grid lg:min-h-svh lg:grid-cols-2 w-full">
      <div className="gap-4 p-6 md:p-10 md:pb-48 w-full lg:h-auto">
        <div className="flex justify-center md:justify-start gap-2">
          <a href="#" className="flex items-center gap-2 font-medium">
            <Logo
              typeClassName="text-2xl h-fit leading-none text-white"
              markClassName="h-7 pb-1.5 translate-y-0 w-fit"
              markTheme="light"
              variant="full"
            />
          </a>
        </div>
        <div className="flex lg:flex-1 items-center justify-center h-full mt-6 lg:mt-0">
          <div className="">
            <SignIn
              waitlistUrl="/waitlist"
              appearance={{
                elements: {
                  headerTitle: "text-2xl tracking-tight",
                  headerSubtitle:
                    "text-sm text-neutral-500 dark:text-neutral-400",
                  card: "card w-full",
                  cardBox: "shadow-lg border lg:w-[444px]",
                },
                layout: {
                  termsPageUrl: "https://rivvi.ai/legal/terms",
                  privacyPageUrl: "https://rivvi.ai/legal/privacy",
                },
                variables: {
                  colorPrimary: "#5955F4",
                  borderRadius: "0.5rem",
                },
              }}
            />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/placeholder.jpeg"
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}
