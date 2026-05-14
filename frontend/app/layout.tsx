import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Agent Boilerplate",
  description: "A modern boilerplate for building intelligent AI agents with Next.js, FastAPI, OpenRouter, and smolagents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-950">
        {/* Global navigation bar */}
        <nav className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-2 flex items-center gap-6">
          <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            AI Agent
          </span>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Chat
          </Link>
          <Link
            href="/orchestrator"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Orchestrator
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
