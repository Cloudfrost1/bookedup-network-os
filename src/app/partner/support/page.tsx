import type { Metadata } from "next";
import SupportPage from "@/modules/shared/support-page";

export const metadata: Metadata = { title: "Support" };
export default function Page() {
  return <SupportPage />;
}
