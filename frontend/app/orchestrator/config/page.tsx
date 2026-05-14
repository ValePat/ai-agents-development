"use client";

import ConfigurationDashboard from "@/components/orchestrator/ConfigurationDashboard";

export default function ConfigPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-purple-500/20 bg-gray-900/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center font-bold text-sm">
              C
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Variable Configuration</h1>
              <p className="text-xs text-gray-500">Centralized Macro Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/orchestrator"
              className="text-sm text-gray-400 hover:text-purple-400 transition-colors"
            >
              ← Back to Orchestrator
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <ConfigurationDashboard />
      </main>
    </div>
  );
}
