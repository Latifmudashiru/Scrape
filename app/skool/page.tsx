"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import { SkoolProduct } from "@/lib/skool";
import { ContactInfo } from "@/lib/enrich";

// Extend SkoolProduct to include local contact info
interface EnrichedSkoolProduct extends SkoolProduct {
  contactInfo?: ContactInfo;
}

export default function SkoolPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<EnrichedSkoolProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const handleCleanLeads = async () => {
    if (products.length === 0) return;
    setEnriching(true);
    
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: products, platform: "skool" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enrichment failed");
      setProducts(data.data);
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
    setHasSearched(true);
    setProducts([]);

    try {
      const res = await fetch("/api/skool/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scraping failed");
      setProducts(data.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const quickSearches = [
    "business", "fitness", "marketing", "mindset", "crypto"
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
          <h1 className="page-title animate-in">
            <span className="page-title-gradient" style={{ backgroundImage: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)" }}>Skool</span> Community Discovery
          </h1>
          <p className="page-subtitle animate-in delay-1">
            Search the Skool platform for highly engaged communities. Find out what top creators are building.
          </p>

          {/* Search */}
          <div className="search-container animate-in delay-2">
            <div className="search-bar">
              <div className="search-input-wrapper">
                <span className="search-input-icon"></span>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search Skool for communities..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <button
                className="search-btn"
                style={{ background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)" }}
                onClick={handleSearch}
                disabled={loading || !query.trim()}
              >
                {loading ? "Scraping..." : " Discover"}
              </button>
              {products.length > 0 && (
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
                  style={query === q ? { borderColor: "#10b981", color: "#10b981", background: "rgba(16, 185, 129, 0.15)" } : {}}
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
              <div className="loading-spinner" style={{ borderTopColor: "#10b981" }} />
              <div className="loading-text">
                Deploying browser and scraping Skool for &quot;{query}&quot;...
              </div>
              <div className="loading-text" style={{ fontSize: 12, opacity: 0.6 }}>
                This takes about 10-15 seconds. We're launching Puppeteer, navigating the discovery page, and scrolling to load communities.
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && hasSearched && (
            <>
              <div className="stats-grid animate-in">
                <StatsCard
                  label="Communities Found"
                  value={products.length.toString()}
                  detail={`for "${query}"`}
                  icon=""
                  color="green"
                />
              </div>

              {products.length > 0 ? (
                <div className="bento-grid">
                  {products.map((p, i) => (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={p.id + i}
                      className={`stat-card animate-in delay-${Math.min((i % 5) + 1, 5)}`}
                      style={{ textDecoration: "none", color: "inherit", display: "flex", gap: "16px", alignItems: "flex-start", flexDirection: "column" }}
                    >
                      <div style={{ display: "flex", gap: "16px", width: "100%" }}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: 80, height: 80, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                              
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>{p.title}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent-green)", marginBottom: 8 }}>{p.price}</div>
                            
                            {p.members && (
                              <div style={{ fontSize: 12, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: 4, display: "inline-block", marginBottom: 8 }}>
                                 {p.members} Members
                              </div>
                            )}
                          </div>
                      </div>
                      
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, opacity: 0.8, marginTop: "8px" }}>
                         {p.description}
                      </div>

                      <div style={{ fontSize: 12, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: 4, display: "inline-block", alignSelf: "flex-end", marginTop: "auto" }}>
                        View on Skool ↗
                      </div>

                      {p.contactInfo && (p.contactInfo.emails.length > 0 || p.contactInfo.socials.length > 0) && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)", width: "100%" }}>
                          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 }}>Contact Info</div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {p.contactInfo.emails.map(e => (
                              <span key={e} style={{ fontSize: 11, background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "2px 6px", borderRadius: 4 }}>
                                 {e}
                              </span>
                            ))}
                            {p.contactInfo.socials.map(s => (
                              <a key={s} href={s} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, background: "rgba(255, 255, 255, 0.1)", color: "white", padding: "2px 6px", borderRadius: 4, textDecoration: "none" }}>
                                {s.includes('instagram') ? ' Instagram' : s.includes('twitter') || s.includes('x.com') ? ' Twitter' : ' Social'}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="empty-state animate-in">
                  <div className="empty-state-icon"></div>
                  <div className="empty-state-title">No communities found</div>
                  <div className="empty-state-desc">
                    We couldn't find any Skool communities matching that query.
                  </div>
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!hasSearched && !loading && (
            <div className="empty-state animate-in delay-3">
              <div className="empty-state-icon"></div>
              <div className="empty-state-title">
                Analyze Skool Communities
              </div>
              <div className="empty-state-desc">
                Enter a niche or keyword above to deploy our headless browser. We'll navigate the Skool discovery page and extract communities, pricing, and URLs.
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
