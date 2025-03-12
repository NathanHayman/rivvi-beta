import { ActivityIcon } from "@/components/shared/icons/activity";
import { AudioLinesIcon } from "@/components/shared/icons/audio-lines";
import { ChartPieIcon } from "@/components/shared/icons/chart-pie";
import { CircleHelpIcon } from "@/components/shared/icons/circle-help";
import { HomeIcon } from "@/components/shared/icons/home";
import { RouteIcon } from "@/components/shared/icons/route";
import { SettingsGearIcon } from "@/components/shared/icons/settings-gear";
import { UsersIcon } from "@/components/shared/icons/users";
import { TSidebarContent } from "./types";

export const SIDEBAR_CONTENT: TSidebarContent = {
  admin_links: [
    {
      title: "Overview",
      href: "/admin",
      icon: {
        icon: HomeIcon,
        iconTitle: "Overview",
      },
    },
    {
      title: "Organizations",
      href: "/admin/organizations",
      icon: {
        icon: UsersIcon,
        iconTitle: "Organizations",
      },
    },
    {
      title: "Campaigns",
      href: "/admin/campaigns",
      icon: {
        icon: RouteIcon,
        iconTitle: "Campaigns",
      },
    },
    {
      title: "Campaign Requests",
      href: "/admin/campaign-requests",
      icon: {
        icon: ActivityIcon,
        iconTitle: "Campaign Requests",
      },
    },
    {
      title: "Playground",
      href: "/admin/playground",
      icon: {
        icon: HomeIcon,
        iconTitle: "Playground",
      },
    },
  ],
  links: [
    {
      title: "Dashboard",
      href: "/",
      icon: {
        icon: ChartPieIcon,
        iconTitle: "Dashboard",
      },
    },
    {
      title: "Campaigns",
      href: "/campaigns",
      icon: {
        icon: RouteIcon,
        iconTitle: "Activity",
      },
    },
    {
      title: "Patients",
      href: "/patients",
      icon: {
        icon: UsersIcon,
        iconTitle: "Patients",
      },
    },
    {
      title: "Call Logs",
      href: "/calls",
      icon: {
        icon: AudioLinesIcon,
        iconTitle: "Phone Call",
      },
    },
  ],
  other_links: [
    {
      title: "Settings",
      href: "/settings",
      icon: {
        icon: SettingsGearIcon,
        iconTitle: "Settings",
      },
    },
    {
      title: "Support",
      href: "/#support",
      icon: {
        icon: CircleHelpIcon,
        iconTitle: "Support",
      },
    },
  ],
  user: {
    name: "Nathan Hayman",
    email: "nathan@semg.com",
    avatar: "/avatars/pfp.jpg",
    role: "Admin",
    organization: {
      name: "Southeast Medical Group",
      slug: "semg",
      logo: "/avatars/org-pfp.jpg",
      plan: "Free",
    },
  },
};
