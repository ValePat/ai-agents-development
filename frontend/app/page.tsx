import ChatInterface from "@/components/ChatInterface";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-900 to-gray-950 py-8 sm:py-12 px-4 sm:px-6">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-screen filter blur-3xl opacity-10 animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12 relative z-10">
        {/* Header Section */}
        <header className="text-center pt-6 sm:pt-12">
          <div className="inline-block mb-4">
            <div className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 bg-opacity-20 border border-purple-500 border-opacity-50">
              <p className="text-xs sm:text-sm font-semibold text-black uppercase tracking-wider">Next Generation AI</p>
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-4 leading-tight">
            AI Agent Boilerplate
          </h1>
          <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
            A powerful, modern boilerplate for building intelligent agents with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-semibold">Next.js</span>,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-semibold">FastAPI</span>, and{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-semibold">smolagents</span>
          </p>
        </header>

        {/* Chat Section */}
        <section className="flex justify-center px-0 sm:px-4">
          <div className="w-full max-w-2xl">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-purple-500 border-opacity-30 shadow-2xl overflow-hidden backdrop-blur-sm">
              <ChatInterface />
            </div>
          </div>
        </section>

        {/* Footer Section */}
        <footer className="text-center pb-8 sm:pb-12">
          <div className="inline-block px-4 sm:px-6 py-3 sm:py-4 rounded-lg bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 border-opacity-50 backdrop-blur-sm">
            <p className="text-xs sm:text-sm text-gray-400 mb-2">
              ✨ Securely managed backend with{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-semibold">smolagents</span>
            </p>
            <p className="text-xs text-gray-500">Built for modern AI-powered applications</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
