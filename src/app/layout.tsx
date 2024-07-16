import "bootstrap/dist/css/bootstrap.min.css";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kayak Dashboard",
  description: "Dashboard for Kayaking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body >{children}</body>
    </html>
  );
}
