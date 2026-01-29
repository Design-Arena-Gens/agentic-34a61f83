"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import { useEffect, useState } from "react";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

type Command = "AI ON" | "AI OFF";

declare global {
  interface WindowEventMap {
    "agent-command": CustomEvent<{ command: Command }>;
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"ON" | "OFF">("ON");

  useEffect(() => {
    const handler = (event: WindowEventMap["agent-command"]) => {
      if (event.detail.command === "AI ON") {
        setStatus("ON");
      } else if (event.detail.command === "AI OFF") {
        setStatus("OFF");
      }
    };

    window.addEventListener("agent-command", handler as EventListener);
    return () => window.removeEventListener("agent-command", handler as EventListener);
  }, []);

  return (
    <html lang="bn" className={inter.variable}>
      <body className="bg-slate-950 text-slate-100 antialiased">
        <main>{children}</main>
        <div
          className="fixed bottom-5 right-5 flex items-center gap-3 rounded-full bg-slate-900/90 px-5 py-3 shadow-soft backdrop-blur"
          role="status"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Agent Status
          </span>
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              status === "ON" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
            }`}
          >
            {status}
          </span>
        </div>
      </body>
    </html>
  );
}
