import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Links created before the three environments were split (e-mails, notifications) keep working.
  async redirects() {
    return [
      { source: "/app/referrals/:path*", destination: "/partner/referrals/:path*", permanent: false },
      { source: "/app/partners", destination: "/partner/network", permanent: false },
      { source: "/app/ranking", destination: "/partner/ranking", permanent: false },
      { source: "/app/opportunities/:path*", destination: "/provider/opportunities/:path*", permanent: false },
      { source: "/app/business/new", destination: "/onboarding", permanent: false },
      { source: "/app/:path+", destination: "/app", permanent: false },
    ];
  },
  experimental: { serverActions: { bodySizeLimit: "40mb" } },
};

export default nextConfig;
