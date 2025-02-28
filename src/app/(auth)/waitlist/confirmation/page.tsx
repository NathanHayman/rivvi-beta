import { ConfettiComponent } from "@/components/auth/waitlist-confirmation";
import { Logo } from "@/components/shared/logos/rivvi-logo";
import { Button } from "@/components/ui/button";
import { CheckIcon, MailIcon, Sparkle } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Waitlist Confirmed - Rivvi",
  description:
    "You have been added to our waitlist! We'll be in touch soon with updates on your waitlist status!",
};

export default function ConfirmationPage() {
  return (
    <ConfettiComponent type="side-cannons">
      <div className="grid w-full lg:min-h-svh lg:grid-cols-2">
        <div className="col-span-2 w-full gap-4 py-6 md:p-10 md:pb-48 lg:h-auto">
          <div className="flex justify-center gap-2">
            <a href="#" className="flex items-center gap-2 font-medium">
              <Logo
                typeClassName="text-2xl h-fit leading-none text-white"
                markClassName="h-7 pb-1.5 translate-y-0 w-fit"
                markTheme="light"
                variant="full"
              />
            </a>
          </div>
          <div className="flex w-full items-center justify-center p-10 lg:p-20">
            <div className="bg-background dark:bg-foreground/90 relative flex w-full flex-col items-center justify-center space-y-12 overflow-hidden rounded-lg border p-6 py-12 backdrop-blur-sm md:shadow-xl lg:h-[500px] lg:w-[800px] lg:p-10">
              <div className="flex h-full flex-col items-center justify-center text-balance">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-green-500/20 bg-green-500/20 text-green-500 lg:h-12 lg:w-12">
                  <CheckIcon className="size-6 text-green-500 lg:size-8" />
                </div>
                <span className="pointer-events-none max-w-md whitespace-pre-wrap bg-gradient-to-b from-black to-gray-800/80 bg-clip-text text-center text-2xl font-bold tracking-tighter text-transparent lg:text-5xl">
                  You have been added to our waitlist!
                </span>
                <p className="mt-3 max-w-md text-wrap text-center text-sm text-gray-500 lg:mt-6 lg:text-base">
                  Thank you for your interest in Rivvi. We&apos;ll be in touch
                  soon with updates on your waitlist status!
                </p>
                <div className="mt-10 flex gap-4">
                  <Link href="https://rivvi.ai/#contact">
                    <Button
                      variant="link"
                      className="w-full dark:invert"
                      effect={"hoverUnderline"}
                      size={"sm"}
                    >
                      <MailIcon className="size-4" />
                      Contact us
                    </Button>
                  </Link>

                  <Button
                    effect={"expandIcon"}
                    icon={Sparkle}
                    iconPlacement="left"
                    className="w-full dark:invert"
                    size={"sm"}
                  >
                    <Link
                      href="https://rivvi.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className=""
                    >
                      Explore Rivvi
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ConfettiComponent>
  );
}
