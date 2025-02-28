import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "./ui/tooltip";

const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TRPCReactProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </TRPCReactProvider>
    </ThemeProvider>
  );
};

export default Providers;
