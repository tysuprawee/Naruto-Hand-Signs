import type { Metadata } from "next";
import "./globals.css";
import CursorGuard from "./cursor-guard";
import AnalyticsTracker from "./analytics-tracker";

import { ModalProvider } from "./components/modal-provider";

export const metadata: Metadata = {
  title: "Shinobi Academy | AI Jutsu Trainer",
  description: "Learn Naruto hand signs using real-time AI computer vision.",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ModalProvider>
          <CursorGuard />
          <AnalyticsTracker />
          {children}
        </ModalProvider>
      </body>
    </html>
  );
}
