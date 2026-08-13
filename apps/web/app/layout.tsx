import type { Metadata } from "next";
import { ServerStateProvider } from "./components/server-state-provider";
import { TenantProvider } from "./components/tenant-provider";
import "./globals.css";

const vercelHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
  process.env.VERCEL_URL?.trim();
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Audentra | Institutional intelligence for what’s next",
    template: "%s | Audentra",
  },
  description:
    "Audentra helps institutions identify enrollment barriers early, prioritize students, and take the right action.",
  applicationName: "Audentra Higher Education Intelligence Platform",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    shortcut: "/icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Audentra",
    title: "Institutional intelligence for what’s next | Audentra",
    description:
      "Convert more admitted students into enrolled students with earlier signals and clearer action.",
    images: [
      {
        url: "/og.png",
        width: 1734,
        height: 907,
        alt: "Audentra institutional portal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Institutional intelligence for what’s next | Audentra",
    description:
      "Convert more admitted students into enrolled students with earlier signals and clearer action.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <TenantProvider>
          <ServerStateProvider>{children}</ServerStateProvider>
        </TenantProvider>
      </body>
    </html>
  );
}
