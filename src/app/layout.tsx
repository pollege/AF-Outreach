import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AF Outreach",
  description: "B2B Cold Outreach Automation by AF Automations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={cn(
          inter.variable,
          "min-h-screen font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50"
        )}
      >
        <div className="relative flex min-h-screen flex-col">
          {/* Sidebar and Header will go here in sub-layouts or components */}
          <main className="flex-1">
            {children}
          </main>
          <Toaster richColors position="top-center" theme="system" />
        </div>
      </body>
    </html>
  );
}
