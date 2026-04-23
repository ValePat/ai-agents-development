"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "agent";
  content: string;
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error("Failed to communicate with the agent");
      }

      const data = await response.json();
      const agentMessage: Message = { role: "agent", content: data.response };
      setMessages((prev) => [...prev, agentMessage]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: "Sorry, I encountered an error. Please check the backend connection." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen sm:h-[600px] w-full bg-gray-900 rounded-none sm:rounded-2xl overflow-hidden border-0 sm:border border-purple-500 border-opacity-30 shadow-2xl">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
        {/* Empty State */}
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-5xl">🤖</div>
              <div>
                <p className="text-lg sm:text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                  Welcome to AI Agent
                </p>
                <p className="text-sm sm:text-base text-gray-400 mt-2">
                  Start a conversation to get things done
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, index) => (
          <div
            key={index}
            className={`flex gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-4 ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {/* Agent Avatar */}
            {m.role === "agent" && (
              <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs sm:text-sm font-bold text-white">
                AI
              </div>
            )}

            {/* Message Bubble */}
            <div
              className={`max-w-xs sm:max-w-md lg:max-w-lg px-3 sm:px-4 py-2 sm:py-3 rounded-xl transition-all duration-200 ${
                m.role === "user"
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-none shadow-lg shadow-blue-500/30"
                  : "bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-none shadow-lg"
              }`}
            >
              <div className="text-xs sm:text-sm font-semibold mb-1 opacity-80">
                {m.role === "user" ? "You" : "Agent"}
              </div>
              <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
                {m.content}
              </div>
            </div>

            {/* User Avatar */}
            {m.role === "user" && (
              <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs sm:text-sm font-bold text-white">
                U
              </div>
            )}
          </div>
        ))}

        {/* Loading State */}
        {isLoading && (
          <div className="flex gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-xs animate-spin">⚡</span>
            </div>
            <div className="bg-gray-800 border border-gray-700 px-4 py-3 rounded-xl rounded-bl-none shadow-lg">
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-bounce [animation-delay:0.15s]"></div>
                <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full animate-bounce [animation-delay:0.3s]"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <div className="flex-shrink-0 bg-gray-800 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 space-y-3">
          <div className="flex gap-2 sm:gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="flex-1 px-4 py-2 sm:py-3 bg-gray-700 text-white placeholder-gray-500 rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all duration-200 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex-shrink-0 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-lg shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <span className="hidden sm:inline">
                {isLoading ? "Thinking..." : "Send"}
              </span>
              <span className="sm:hidden">
                {isLoading ? "..." : "→"}
              </span>
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center">Powered by AI Agent</p>
        </form>
      </div>
    </div>
  );
}
