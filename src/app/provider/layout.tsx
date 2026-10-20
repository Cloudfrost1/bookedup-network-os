import { BusinessEnvLayout } from "@/modules/shared/env-layout";

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return <BusinessEnvLayout env="provider">{children}</BusinessEnvLayout>;
}
