import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: { default: "GATP Accounting Work", template: "%s · GATP" },
  description: "Internal task management and work distribution for the GATP accounting team.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f6f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
