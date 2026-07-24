import type { Metadata } from "next";
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
    "Review your Aster University offer and complete your enrollment requirements.",
  applicationName: "Aster University Student Portal",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    shortcut: "/icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Aster University Student Portal",
    title: "Your enrollment starts here | Aster University",
    description:
      "Review your admission offer and complete your enrollment requirements.",
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
    title: "Your enrollment starts here | Aster University",
    description:
      "Review your admission offer and complete your enrollment requirements.",
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
      <body>{children}</body>
    </html>
  );
}
