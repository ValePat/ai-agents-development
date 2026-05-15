"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const API_BASE = "http://localhost:8000";

type ShowProfile = {
  id: string;
  name: string;
  description: string;
  genres: string[];
  core_vibes: string[];
};

type ToastMsg = {
  id: number;
  text: string;
  type: "success" | "error" | "info";
};

export default function ShowsPage() {
  const [shows, setShows] = useState<ShowProfile[]>([]);
  const [activeShowId, setActiveShowId] = useState("");
  const [isEditing, setIsEditing] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<ShowProfile>({
    id: "",
    name: "",
    description: "",
    genres: [],
    core_vibes: [],
  });
  const [genreInput, setGenreInput] = useState("");
  const [vibeInput, setVibeInput] = useState("");

  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const addToast = useCallback((text: string, type: ToastMsg["type"] = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const fetchShows = useCallback(async () => {
    try {
      const [allRes, activeRes] = await Promise.all([
        fetch(`${API_BASE}/orchestrator/shows`),
        fetch(`${API_BASE}/orchestrator/shows/active`)
      ]);
      if (allRes.ok) setShows(await allRes.json());
      if (activeRes.ok) {
        const active = await activeRes.json();
        setActiveShowId(active.id);
      }
    } catch (err) {
      addToast("Failed to fetch shows", "error");
    }
  }, [addToast]);

  useEffect(() => {
    fetchShows();
  }, [fetchShows]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id || !form.name) {
      addToast("ID and Name are required", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/orchestrator/shows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          genres: genreInput.split(",").map(s => s.trim()).filter(Boolean),
          core_vibes: vibeInput.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });

      if (res.ok) {
        addToast("Show saved", "success");
        setIsEditing(null);
        setForm({ id: "", name: "", description: "", genres: [], core_vibes: [] });
        setGenreInput("");
        setVibeInput("");
        fetchShows();
      } else {
        throw new Error("Failed to save");
      }
    } catch (err) {
      addToast("Save failed", "error");
    }
  };

  const handleEdit = (show: ShowProfile) => {
    setIsEditing(show.id);
    setForm(show);
    setGenreInput(show.genres.join(", "));
    setVibeInput(show.core_vibes.join(", "));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSetActive = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/orchestrator/shows/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setActiveShowId(id);
        addToast("Active show updated", "success");
      }
    } catch (err) {
      addToast("Failed to set active show", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (id === "default_show") {
      addToast("Cannot delete the default show", "error");
      return;
    }

    if (!confirm(`Are you sure you want to delete the show "${id}"?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/orchestrator/shows/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        addToast("Show deleted", "success");
        fetchShows();
      } else {
        const err = await res.json();
        throw new Error(err.detail || "Delete failed");
      }
    } catch (err) {
      addToast(`Delete failed: ${err instanceof Error ? err.message : "Unknown"}`, "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 max-w-4xl mx-auto space-y-8">
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link 
            href="/"
            className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Show Manager</h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Configure artistic guidelines and show metadata</p>
          </div>
        </div>
      </header>

      {/* Show Editor */}
      <section className="bg-gray-800/60 border border-purple-500/20 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-xs font-semibold text-purple-400 uppercase tracking-widest">
          {isEditing ? `Editing Show: ${isEditing}` : "Create New Show"}
        </h2>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Unique ID (slug)</label>
            <input
              type="text"
              value={form.id}
              disabled={!!isEditing}
              onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              placeholder="e.g. techno_night"
              className="w-full px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 outline-none text-sm disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Show Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Warehouse Techno Set"
              className="w-full px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 outline-none text-sm"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs text-gray-400">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Overall artistic vision..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 outline-none text-sm resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Genres (comma separated)</label>
            <input
              type="text"
              value={genreInput}
              onChange={(e) => setGenreInput(e.target.value)}
              placeholder="Electro, House, Minimal"
              className="w-full px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 outline-none text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Core Vibes (comma separated)</label>
            <input
              type="text"
              value={vibeInput}
              onChange={(e) => setVibeInput(e.target.value)}
              placeholder="Bouncy, Dark, Cinematic"
              className="w-full px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 outline-none text-sm"
            />
          </div>
          <div className="md:col-span-2 flex gap-2 pt-2">
            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-all"
            >
              {isEditing ? "Update Show" : "Create Show"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(null);
                  setForm({ id: "", name: "", description: "", genres: [], core_vibes: [] });
                  setGenreInput("");
                  setVibeInput("");
                }}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Show List */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest">
          Available Show Profiles
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {shows.map((show) => (
            <div
              key={show.id}
              className={`p-5 rounded-2xl border transition-all ${
                activeShowId === show.id
                  ? "bg-purple-900/20 border-purple-500/50"
                  : "bg-gray-800/40 border-gray-700 hover:border-gray-600"
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">{show.name}</h3>
                    {activeShowId === show.id && (
                      <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-bold uppercase">Active</span>
                    )}
                  </div>
                  <code className="text-[10px] text-gray-500">ID: {show.id}</code>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(show)}
                    className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md transition-all"
                  >
                    Edit
                  </button>
                  {activeShowId !== show.id && (
                    <button
                      onClick={() => handleSetActive(show.id)}
                      className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-md transition-all"
                    >
                      Set Active
                    </button>
                  )}
                  {show.id !== "default_show" && (
                    <button
                      onClick={() => handleDelete(show.id)}
                      className="text-xs px-3 py-1 bg-red-900/40 hover:bg-red-600 rounded-md text-red-400 hover:text-white border border-red-500/30 transition-all"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-4">{show.description}</p>
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-gray-500 font-bold uppercase tracking-tighter">Genres</span>
                  <div className="flex gap-1">
                    {show.genres.map(g => (
                      <span key={g} className="bg-gray-900 px-2 py-0.5 rounded-md text-gray-300">{g}</span>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-500 font-bold uppercase tracking-tighter">Vibes</span>
                  <div className="flex gap-1">
                    {show.core_vibes.map(v => (
                      <span key={v} className="bg-gray-900 px-2 py-0.5 rounded-md text-gray-300">{v}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl text-sm font-medium shadow-xl border transition-all animate-in slide-in-from-right-4 fade-in pointer-events-auto max-w-sm ${
              t.type === "success"
                ? "bg-green-900/90 border-green-500/50 text-green-300"
                : t.type === "error"
                ? "bg-red-900/90 border-red-500/50 text-red-300"
                : "bg-gray-800/90 border-gray-600/50 text-gray-300"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
