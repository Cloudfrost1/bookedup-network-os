import type { Metadata } from "next";
import BusinessPage from "@/modules/shared/business-page";

export const metadata: Metadata = { title: "My Business" };
export default function Page() {
  return <BusinessPage />;
}
