import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RoboTrader Web",
  description: "Advanced Algorithmic Trading Dashboard",
};

import ThemeRegistry from "@/components/ThemeRegistry";
import AuthProvider from "@/components/AuthProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <ThemeRegistry>
            <Navbar />
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
              {children}
            </main>
          </ThemeRegistry>
        </AuthProvider>
      </body>
    </html>
  );
}
