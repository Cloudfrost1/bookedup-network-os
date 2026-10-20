import type { Metadata } from "next";
import NotificationsPage from "@/modules/shared/notifications-page";

export const metadata: Metadata = { title: "Notifications" };
export default function Page() {
  return <NotificationsPage />;
}
