import { Logo } from "@/components/shared/logos/rivvi-logo";
import { Waitlist } from "@clerk/nextjs";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join the waitlist - Rivvi",
  description:
    "Join the waitlist for Rivvi's human-like conversational AI for healthcare.",
};

export default function WaitlistPage() {
  return (
    <div className="grid w-full lg:min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10 md:pb-48 lg:h-auto">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <Logo
              typeClassName="text-2xl h-fit leading-none text-white"
              markClassName="h-7 pb-1.5 translate-y-0 w-fit"
              markTheme="light"
              variant="full"
            />
          </a>
        </div>
        <div className="mt-6 flex h-full items-center justify-center lg:mt-0 lg:flex-1">
          <div className="">
            <Waitlist
              afterJoinWaitlistUrl="/waitlist/confirmation"
              appearance={{
                elements: {
                  header: "text-left",
                  headerTitle: "text-2xl tracking-tight",
                  headerSubtitle:
                    "text-sm text-neutral-500 dark:text-neutral-400",
                  //   formButtonPrimary: "bg-[#5955F4]",
                  card: "card w-full",
                  cardBox: "shadow-lg border lg:w-[444px]",
                  footer: "",
                },
                layout: {
                  logoImageUrl: "/brand/rivvi_bot_250x150.svg",
                  logoPlacement: "none",
                  animations: true,
                  shimmer: true,
                  termsPageUrl: "https://rivvi.ai/legal/terms",
                  privacyPageUrl: "https://rivvi.ai/legal/privacy",
                },
                variables: {
                  borderRadius: "0.5rem",
                  colorPrimary: "#5955F4",
                },
              }}
            />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
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
