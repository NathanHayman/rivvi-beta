import { AnimatedIconProps } from "@/components/shared/icons/animated-icon";

export type TNavLinkIcon = {
  icon: React.FC<AnimatedIconProps>;
  iconTitle: string;
  className?: string;
  iconClassName?: string;
};

export interface TNavLinkItem {
  href?: string;
  title: string;
  icon?: TNavLinkIcon;
  isActive?: boolean;
  items?: TNavLinkItem[] | TNavLinkItem | null;
}

export interface TNavOrg {
  name: string;
  slug: string;
  logo: string;
  plan: string;
}

export interface TNavUser {
  name: string;
  email: string;
  avatar: string;
  role: string;
  organization: TNavOrg;
}

export interface TSidebarContent {
  links: TNavLinkItem[];
  other_links: TNavLinkItem[];
  user: TNavUser;
  admin_links: TNavLinkItem[];
}
