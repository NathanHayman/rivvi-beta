import {
  Building,
  CircleHelp,
  Code,
  Home,
  List,
  Phone,
  Settings,
  Users,
} from "lucide-react";
import { TSidebarContent } from "./types";

export const SIDEBAR_CONTENT: TSidebarContent = {
  admin_links: [
    {
      title: "Overview",
      href: "/admin",
      icon: {
        icon: Home,
        iconTitle: "Overview",
      },
    },
    {
      title: "Organizations",
      href: "/admin/organizations",
      icon: {
        icon: Building,
        iconTitle: "Organizations",
      },
    },
    {
      title: "Campaigns",
      href: "/admin/campaigns",
      icon: {
        icon: List,
        iconTitle: "Campaigns",
      },
    },
    {
      title: "Campaign Requests",
      href: "/admin/campaign-requests",
      icon: {
        icon: List,
        iconTitle: "Campaign Requests",
      },
    },
    {
      title: "Playground",
      href: "/admin/playground",
      icon: {
        icon: Code,
        iconTitle: "Playground",
      },
    },
  ],
  links: [
    {
      title: "Dashboard",
      href: "/",
      icon: {
        icon: Home,
        iconTitle: "Dashboard",
      },
    },
    {
      title: "Campaigns",
      href: "/campaigns",
      icon: {
        icon: List,
        iconTitle: "Activity",
      },
    },
    {
      title: "Patients",
      href: "/patients",
      icon: {
        icon: Users,
        iconTitle: "Patients",
      },
    },
    {
      title: "Call Logs",
      href: "/calls",
      icon: {
        icon: Phone,
        iconTitle: "Phone Call",
      },
    },
  ],
  other_links: [
    {
      title: "Settings",
      href: "/settings",
      icon: {
        icon: Settings,
        iconTitle: "Settings",
      },
    },
    {
      title: "Support",
      href: "/#support",
      icon: {
        icon: CircleHelp,
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
