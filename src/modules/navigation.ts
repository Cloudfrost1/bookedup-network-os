import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Send,
  Trophy,
  Users,
  CheckSquare,
  Network,
  BarChart3,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which approved capability the item needs. */
  needs?: "refer" | "receive" | "approved";
  /** Phase in which the screen ships; items for later phases stay hidden until built. */
  phase: number;
};

export const CURRENT_PHASE = 1;

export const appNav: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, phase: 1 },
  { href: "/app/referrals/new", label: "Send Referral", icon: Send, needs: "refer", phase: 3 },
  { href: "/app/referrals", label: "My Referrals", icon: ClipboardList, needs: "refer", phase: 3 },
  { href: "/app/opportunities", label: "Opportunities", icon: Inbox, needs: "receive", phase: 4 },
  { href: "/app/partners", label: "Find Partners", icon: Users, needs: "approved", phase: 2 },
  { href: "/app/ranking", label: "My Ranking", icon: Trophy, needs: "approved", phase: 5 },
  { href: "/app/business", label: "My Business", icon: Building2, phase: 1 },
  { href: "/app/support", label: "Support", icon: LifeBuoy, phase: 1 },
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, phase: 1 },
  { href: "/admin/approvals", label: "Pending Approvals", icon: CheckSquare, phase: 1 },
  { href: "/admin/organizations", label: "Organizations", icon: Building2, phase: 2 },
  { href: "/admin/referrals", label: "Referrals", icon: ClipboardList, phase: 3 },
  { href: "/admin/matching", label: "Matching", icon: Network, phase: 4 },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, phase: 5 },
  { href: "/admin/settings", label: "Settings", icon: Settings, phase: 5 },
];

export function visibleItems(items: NavItem[], caps: { approved: boolean; refer: boolean; receive: boolean }) {
  return items.filter((i) => i.phase <= CURRENT_PHASE && (!i.needs || caps[i.needs]));
}
