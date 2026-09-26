"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import ChannelTable from "@/components/ChannelTable";
import VideoTable from "@/components/VideoTable";
import EngagementChart from "@/components/EngagementChart";
import { ChannelResult, VideoResult } from "@/lib/youtube";

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toLocaleString();
}

interface AnalysisResult {
  query: string;
  channels: ChannelResult[];
  topVideos: VideoResult[];
  stats: {
    totalChannels: number;
    avgSubscribers: number;
    avgViews: number;
    avgEngagement: number;
    totalVideosAnalyzed: number;
  };
}

export default function YouTubePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [channelVideos, setChannelVideos] = useState<VideoResult[]>([]);
  const [channelVideosTitle, setChannelVideosTitle] = useState("");
  const [enriching, setEnriching] = useState(false);

  const handleCleanLeads = async () => {
    if (!analysis || analysis.channels.length === 0) return;
    setEnriching(true);
    
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: analysis.channels, platform: "youtube" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enrichment failed");
      
      // Update analysis state with enriched channels
      setAnalysis({
        ...analysis,
        channels: data.data
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setChannelVideos([]);
    setChannelVideosTitle("");

    try {
      const res = await fetch("/api/youtube/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleViewVideos = async (channelId: string) => {
    const ch = analysis?.channels.find((c) => c.id === channelId);
    setChannelVideosTitle(ch?.title || "Channel");

    try {
      const res = await fetch("/api/youtube/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, includeVideos: true, maxVideos: 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannelVideos(data.videos || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load videos");
    }
  };

  const quickSearches = [
    "online coaching", "life coaching", "business coaching",
    "fitness coaching online", "dating coach", "career coaching",
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
          <h1 className="page-title animate-in">
            <span className="page-title-gradient">YouTube</span> Scraper
          </h1>
          <p className="page-subtitle animate-in delay-1">
            Search and analyze coaching channels, videos, and engagement metrics
            across YouTube.
          </p>

          {/* Search */}
          <div className="search-container animate-in delay-2">
            <div className="search-bar">
              <div className="search-input-wrapper">
                <span className="search-input-icon"></span>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search a coaching niche (e.g. 'online coaching', 'business mentorship')..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <button
                className="search-btn"
                onClick={handleSearch}
                disabled={loading || !query.trim()}
              >
                {loading ? "Analyzing..." : " Analyze Niche"}
              </button>
              {analysis && (
                <button
                  className="search-btn"
                  style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", padding: "12px 20px" }}
                  onClick={handleCleanLeads}
                  disabled={enriching || loading}
                >
                  {enriching ? "⏳ Cleaning..." : " Clean Leads"}
                </button>
              )}
            </div>
            <div className="search-filters">
              {quickSearches.map((q) => (
                <button
                  key={q}
                  className={`filter-chip ${query === q ? "active" : ""}`}
                  onClick={() => { setQuery(q); }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="error-banner animate-in">
               {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner" />
              <div className="loading-text">
                Analyzing &quot;{query}&quot; across YouTube...
              </div>
              <div className="loading-text" style={{ fontSize: 12, opacity: 0.6 }}>
                Searching channels, fetching videos, calculating engagement
              </div>
            </div>
          )}

          {/* Results */}
          {analysis && !loading && (
            <>
              {/* Stats */}
              <div className="stats-grid">
                <StatsCard
                  label="Channels Found"
                  value={analysis.stats.totalChannels.toString()}
                  detail={`for "${analysis.query}"`}
                  icon=""
                  color="purple"
                />
                <StatsCard
                  label="Avg Subscribers"
                  value={formatNumber(analysis.stats.avgSubscribers)}
                  detail="per channel"
                  icon=""
                  color="cyan"
                />
                <StatsCard
                  label="Avg Total Views"
                  value={formatNumber(analysis.stats.avgViews)}
                  detail="per channel"
                  icon=""
                  color="green"
                />
                <StatsCard
                  label="Avg Engagement"
                  value={analysis.stats.avgEngagement.toFixed(2) + "%"}
                  detail="(likes+comments)/views"
                  icon=""
                  color="orange"
                />
                <StatsCard
                  label="Videos Analyzed"
                  value={analysis.stats.totalVideosAnalyzed.toString()}
                  detail="top performing"
                  icon=""
                  color="pink"
                />
              </div>

              {/* Chart */}
              <EngagementChart channels={analysis.channels} />

              {/* Channel Table */}
              <ChannelTable
                channels={analysis.channels}
                onViewVideos={handleViewVideos}
              />

              {/* Channel-specific videos */}
              {channelVideos.length > 0 && (
                <VideoTable
                  videos={channelVideos}
                  title={` Recent Videos — ${channelVideosTitle}`}
                />
              )}

              {/* Top Videos */}
              <VideoTable
                videos={analysis.topVideos}
                title=" Top Videos in Niche"
              />
            </>
          )}

          {/* Empty State */}
          {!analysis && !loading && (
            <div className="empty-state animate-in delay-3">
              <div className="empty-state-icon"></div>
              <div className="empty-state-title">
                Ready to discover your coaching niche
              </div>
              <div className="empty-state-desc">
                Enter a search term above to analyze channels, videos, and
                engagement metrics across YouTube. Try clicking one of the quick
                search filters!
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
