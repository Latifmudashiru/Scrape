"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import { InstagramLead } from "@/lib/instagram";

export default function InstagramPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<InstagramLead[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setHasSearched(true);
    setLeads([]);

    try {
      const res = await fetch("/api/instagram/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), maxResults: 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scraping failed");
      setLeads(data.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (leads.length === 0) return;

    // Helper to escape CSV values
    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;

    const headers = ["ID", "Name", "Username", "Followers", "Following", "Posts", "Profile URL", "Emails", "Description"];
    const rows = leads.map(l => [
      escapeCsv(l.id),
      escapeCsv(l.name),
      escapeCsv(l.username),
      escapeCsv(l.followers || "N/A"),
      escapeCsv(l.following || "N/A"),
      escapeCsv(l.posts || "N/A"),
      escapeCsv(l.url),
      escapeCsv(l.emails.join(", ")),
      escapeCsv(l.description)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `instagram_leads_${query.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const quickSearches = [
    "business coach", "fitness trainer", "marketing agency", "crypto mentor", "mindset coach"
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
          <h1 className="page-title animate-in">
            <span className="page-title-gradient" style={{ backgroundImage: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)" }}>Instagram</span> Lead Scraper
          </h1>
          <p className="page-subtitle animate-in delay-1">
            Find targeted Instagram leads bypass-free. Extract emails, profiles, and follower stats utilizing search engine query dorking.
          </p>

          {/* Search */}
          <div className="search-container animate-in delay-2">
            <div className="search-bar">
              <div className="search-input-wrapper">
                <span className="search-input-icon"></span>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Enter niche keywords (e.g. 'fitness trainer', 'business coach')..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <button
                className="search-btn"
                style={{ background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)" }}
                onClick={handleSearch}
                disabled={loading || !query.trim()}
              >
                {loading ? "Scraping..." : " Scrape Leads"}
              </button>
              {leads.length > 0 && (
                <button
                  className="search-btn"
                  style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                  onClick={handleExportCSV}
                >
                   Export CSV
                </button>
              )}
            </div>
            <div className="search-filters">
              {quickSearches.map((q) => (
                <button
                  key={q}
                  className={`filter-chip ${query === q ? "active" : ""}`}
                  style={query === q ? { borderColor: "#ec4899", color: "#ec4899", background: "rgba(236, 72, 153, 0.15)" } : {}}
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
              <div className="loading-spinner" style={{ borderTopColor: "#ec4899" }} />
              <div className="loading-text">
                Deploying search stealth browser for &quot;{query}&quot;...
              </div>
              <div className="loading-text" style={{ fontSize: 12, opacity: 0.6 }}>
                This takes about 8-12 seconds. We are executing Google Search dorking syntax via Puppeteer Stealth on DuckDuckGo Lite to fetch bypass-free leads.
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && hasSearched && (
            <>
              <div className="stats-grid animate-in">
                <StatsCard
                  label="Instagram Leads Found"
                  value={leads.length.toString()}
                  detail={`for niche "${query}"`}
                  icon=""
                  color="pink"
                />
                <StatsCard
                  label="Enriched with Email"
                  value={leads.filter(l => l.emails.length > 0).length.toString()}
                  detail="Direct outreach contacts"
                  icon=""
                  color="green"
                />
              </div>

              {leads.length > 0 ? (
                <div className="bento-grid">
                  {leads.map((lead, i) => (
                    <a
                      href={lead.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={lead.id + i}
                      className={`stat-card animate-in delay-${Math.min((i % 5) + 1, 5)}`}
                      style={{ textDecoration: "none", color: "inherit", display: "flex", gap: "16px", alignItems: "flex-start", flexDirection: "column" }}
                    >
                      <div style={{ display: "flex", gap: "16px", width: "100%" }}>
                        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #f9ce34 0%, #ee2a7b 50%, #6228d7 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff", flexShrink: 0 }}>
                          
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {lead.name}
                          </div>
                          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 6 }}>
                            @{lead.username}
                          </div>
                          
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {lead.followers && (
                              <span style={{ fontSize: 11, color: "var(--text-secondary)", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>
                                 {lead.followers} followers
                              </span>
                            )}
                            {lead.posts && (
                              <span style={{ fontSize: 11, color: "var(--text-secondary)", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>
                                 {lead.posts} posts
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, opacity: 0.8, flexGrow: 1, width: "100%", wordBreak: "break-word" }}>
                        {lead.description}
                      </div>

                      <div style={{ width: "100%", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px", marginTop: "4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                          Outreach Details
                        </div>
                        {lead.emails.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {lead.emails.map(email => (
                              <div key={email} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: "6px", color: "#34d399", fontWeight: 500 }}>
                                 {email}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                            No email listed in bio snippet.
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: 12, color: "#a78bfa", background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.2)", padding: "4px 8px", borderRadius: 4, display: "inline-block", alignSelf: "flex-end", marginTop: "auto" }}>
                        View on Instagram ↗
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                  No profiles matching "{query}" found. Try broadening your keywords.
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
