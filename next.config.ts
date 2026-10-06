import type { NextConfig } from "next";

/** Extra hosts allowed to call Server Actions, for a reverse proxy that does not forward the public host (X-Forwarded-Host). "app.example.com,*.example.com". */
const allowedOrigins = (process.env.APP_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedOrigins.length > 0 ? { experimental: { serverActions: { allowedOrigins } } } : {}),
  // Self-contained production server (.next/standalone): only traced files and a minimal node_modules subset, no full install needed
  // at runtime. Used by the production Dockerfile; `next dev`/`next start` outside Docker are unaffected.
  output: "standalone",
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
