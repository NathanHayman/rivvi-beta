"use client";

import { Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import { SidebarMenuButton } from "../ui/sidebar";

export function RegularThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-accent-foreground/50" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-accent-foreground/50" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className="ml-[0.4rem] max-w-[13.6rem] group-data-[collapsible=icon]:ml-[0.2rem] group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:overflow-hidden"
      >
        <SidebarMenuButton className="w-full px-2.5 py-[1.1rem] border border-transparent transition-all duration-300 ease-in-out focus:outline-1 focus:outline-accent-foreground/5 focus:outline-offset-0 hover:bg-accent hover:text-accent-foreground">
          <Palette className="size-[1.05rem] text-accent-foreground/50 group-data-[collapsible=icon]:mx-auto" />
          <span className="text-left text-xs group-data-[collapsible=icon]:hidden text-accent-foreground/80">
            Toggle Theme
          </span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-50">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
