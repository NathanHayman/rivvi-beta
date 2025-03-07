import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "../ui/tooltip";
import { QueryProvider } from "./query-provider";

const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
};

export default Providers;
