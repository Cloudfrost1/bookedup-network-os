import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Building2,
  CheckSquare,
  ClipboardList,
  Gauge,
  HardHat,
  Handshake,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Map as MapIcon,
  Medal,
  Rocket,
  Send,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which approval the item needs. */
  needs?: "refer" | "receive" | "approved";
};

export const partnerNav: NavItem[] = [
  { href: "/partner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/partner/referrals/new", label: "Send Referral", icon: Send, needs: "refer" },
  { href: "/partner/referrals", label: "My Referrals", icon: ClipboardList },
  { href: "/partner/network", label: "Find Partners", icon: Users, needs: "approved" },
  { href: "/partner/ranking", label: "My Ranking", icon: Trophy },
  { href: "/partner/business", label: "My Business", icon: Building2 },
  { href: "/partner/notifications", label: "Notifications", icon: Bell },
  { href: "/partner/support", label: "Support", icon: LifeBuoy },
];

export const providerNav: NavItem[] = [
  { href: "/provider", label: "Dashboard", icon: LayoutDashboard },
  { href: "/provider/opportunities", label: "Opportunities", icon: Inbox, needs: "receive" },
  { href: "/provider/capacity", label: "Capacity & Documents", icon: Gauge },
  { href: "/provider/growth", label: "BookedUp Growth", icon: Rocket },
  { href: "/provider/reliability", label: "Reliability", icon: ShieldCheck },
  { href: "/provider/business", label: "My Business", icon: Building2 },
  { href: "/provider/notifications", label: "Notifications", icon: Bell },
  { href: "/provider/support", label: "Support", icon: LifeBuoy },
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/approvals", label: "Pending Approvals", icon: CheckSquare },
  { href: "/admin/partners", label: "Partners (Anchors)", icon: Handshake },
  { href: "/admin/providers", label: "Providers", icon: HardHat },
  { href: "/admin/organizations", label: "All Organizations", icon: Building2 },
  { href: "/admin/referrals", label: "Referrals & Matching", icon: ClipboardList },
  { href: "/admin/growth", label: "Growth Clients", icon: Rocket },
  { href: "/admin/rankings", label: "Rankings", icon: Medal },
  { href: "/admin/coverage", label: "Regional Coverage", icon: MapIcon },
  { href: "/admin/relationships", label: "Relationships", icon: Link2 },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function visibleItems(items: NavItem[], caps: { approved: boolean; refer: boolean; receive: boolean }) {
  return items.filter((i) => !i.needs || caps[i.needs]);
}
