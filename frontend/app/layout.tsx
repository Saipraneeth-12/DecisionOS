import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { ClientOnly } from "@/components/ui/client-only";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DecisionOS — Agentic Decision Intelligence",
  description: "Enterprise decision intelligence platform powered by multi-agent AI orchestration",
  icons: { icon: "/favicon.ico" },
};

/** Minimal shell rendered on the server — no interactive elements, no Zustand */
function AppShell() {
  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ background: "#08080e" }}
      aria-hidden="true"
    >
      {/* Ambient glows — purely decorative, no hydration mismatch risk */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[15%] w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{ background: "rgba(99,102,241,0.04)" }} />
        <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] rounded-full blur-[100px]"
          style={{ background: "rgba(168,85,247,0.04)" }} />
      </div>
      {/* Left sidebar skeleton */}
      <div className="w-72 flex-shrink-0 h-full border-r"
        style={{ background: "rgba(8,8,14,0.98)", borderColor: "rgba(255,255,255,0.06)" }} />
      {/* Center skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl shimmer" />
          <div className="w-32 h-3 rounded-full shimmer" />
          <div className="w-24 h-2 rounded-full shimmer opacity-50" />
        </div>
      </div>
      {/* Right panel skeleton */}
      <div className="w-80 flex-shrink-0 h-full border-l"
        style={{ background: "rgba(8,8,14,0.98)", borderColor: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {/*
          ClientOnly prevents SSR → client hydration mismatches caused by:
          1. Zustand state (sidebarOpen, etc.) being undefined on the server
          2. Browser extensions (Bitwarden, LastPass) injecting fdprocessedid
             onto <button> and <input> elements before React hydrates
        */}
        <ClientOnly fallback={<AppShell />}>
          {children}
        </ClientOnly>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(15,15,25,0.95)",
              color: "#f1f5f9",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px",
              backdropFilter: "blur(12px)",
            },
          }}
        />
      </body>
    </html>
  );
}
