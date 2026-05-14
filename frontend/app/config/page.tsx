"use client";

import Link from "next/link";
import ConfigurationDashboard from "@/components/orchestrator/ConfigurationDashboard";

export default function ConfigPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col font-sans antialiased">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">System Configuration</h1>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Define and manage show variables</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-white mb-2 italic uppercase">Macro Definitions</h2>
            <p className="text-sm text-gray-400 max-w-2xl">
              These variables are the semantic bridge between the director's prompts and the technical systems. 
              Adding or removing fields here will dynamically update the LLM's system prompt and the OSC dispatch loop.
            </p>
          </div>
          
          <ConfigurationDashboard />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-gray-900 text-center text-[10px] text-gray-600 uppercase tracking-[0.3em]">
        Orchestrator v2.0 &mdash; Reactive Interpolation Engine
      </footer>
    </div>
  );
}
