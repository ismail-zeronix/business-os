import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev-only Next indicator from covering the sidebar footer (the acting user).
  devIndicators: { position: "bottom-right" },
  // Node-specific IMAP, SMTP, MIME and browser-automation libraries: load them with native `require` instead of bundling them into Server Components.
  serverExternalPackages: ["imapflow", "postal-mime", "nodemailer", "playwright-core"],
  // Playwright loads this manifest dynamically; include it in server deployments.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/playwright-core/browsers.json"],
  },
};

export default nextConfig;
