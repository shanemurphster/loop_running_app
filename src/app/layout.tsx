import type { Metadata, Viewport } from "next";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { StoreProvider } from "@/lib/store";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Loop — Discover your next run",
  description:
    "A taste-based discovery platform for running routes. Loop shows where you should run.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-loop-ink text-zinc-100 antialiased">
        <StoreProvider>
          {/* Mobile-first: app is a centered 480px column on desktop. */}
          <div className="relative mx-auto min-h-screen w-full max-w-app bg-loop-ink">
            <main className="pb-24">{children}</main>
            <BottomNav />
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
