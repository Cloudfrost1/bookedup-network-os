import { BusinessEnvLayout } from "@/modules/shared/env-layout";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <BusinessEnvLayout env="partner">{children}</BusinessEnvLayout>;
}
