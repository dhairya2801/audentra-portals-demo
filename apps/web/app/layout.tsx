import type { Metadata } from "next";
import { ServerStateProvider } from "./components/server-state-provider";
import { TenantProvider } from "./components/tenant-provider";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Student Portal | Aster University",
    template: "%s | Aster University",
  },
  description:
    "Manage enrollment, financial aid, academics, campus life, and student support from one connected Aster University portal.",
  applicationName: "Aster University Student Portal",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    shortcut: "/icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Aster University Student Portal",
    title: "Your connected student life | Aster University",
    description:
      "Enrollment, financials, classrooms, campus life, and Edward AI in one student portal.",
    images: [
      {
        url: "/og.png",
        width: 1734,
        height: 907,
        alt: "Aster University — Your enrollment starts here.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Your connected student life | Aster University",
    description:
      "Enrollment, financials, classrooms, campus life, and Edward AI in one student portal.",
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
