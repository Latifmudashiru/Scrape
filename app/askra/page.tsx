"use client";

import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { useState } from "react";
import { downloadCSV, normalizeYouTube, normalizeWhop, normalizeSkool, normalizeInstagram } from "@/lib/csv";

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const handleOmniSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    
    try {
      setProgress("Searching YouTube...");
      const ytRes = await fetch("/api/youtube/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() })
      });
      const ytData = await ytRes.json();
      const ytChannels = ytData.channels || [];
      
      setProgress("Searching Whop...");
      const whopRes = await fetch("/api/whop/scrape", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() })
      });
      const whopData = await whopRes.json();
      const whopProducts = whopData.results || [];
      
      setProgress("Searching Skool...");
      const skoolRes = await fetch("/api/skool/scrape", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() })
      });
      const skoolData = await skoolRes.json();
      const skoolProducts = skoolData.data || [];

      setProgress("Searching Instagram (Stealth Dorking)...");
      const igRes = await fetch("/api/instagram/scrape", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), maxResults: 20 })
      });
      const igData = await igRes.json();
      const igLeads = igData.data || [];
      
      setProgress("Extracting Contacts (This may take a moment)...");
      
      // Enrich YouTube
      const ytEnrichRes = await fetch("/api/enrich", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: ytChannels, platform: "youtube" })
      });
      const enrichedYt = (await ytEnrichRes.json()).data || [];
      
      // Enrich Whop
      const whopEnrichRes = await fetch("/api/enrich", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: whopProducts, platform: "whop" })
      });
      const enrichedWhop = (await whopEnrichRes.json()).data || [];
      
      // Enrich Skool
      const skoolEnrichRes = await fetch("/api/enrich", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: skoolProducts, platform: "skool" })
      });
      const enrichedSkool = (await skoolEnrichRes.json()).data || [];
      
      setProgress("Deduplicating leads (Supabase filter)...");
      
      // Combine all scraped and enriched leads
      const allData = [
        ...normalizeYouTube(enrichedYt),
        ...normalizeWhop(enrichedWhop),
        ...normalizeSkool(enrichedSkool),
        ...normalizeInstagram(igLeads)
      ];

      // Send to server-side filter to get exactly 25 fresh ones per platform
      const filterRes = await fetch("/api/leads/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: allData })
      });
      const filterData = await filterRes.json();
      if (!filterRes.ok) throw new Error(filterData.error || "Filtering failed");
      
      const freshLeads = filterData.data || [];
      const { breakdown } = filterData.metadata || { breakdown: { youtube: 0, whop: 0, skool: 0, instagram: 0 } };

      setProgress("Generating CSV...");
      
      if (freshLeads.length === 0) {
        alert("Daily Clean Results: No new leads were found today. All scraped profiles are already registered in your database!");
      } else {
        downloadCSV(freshLeads, `${query.replace(/\s+/g, "_")}_leads.csv`);
        alert(
          `Daily Clean Results Downloaded!\n\nDiscovered ${freshLeads.length} brand-new target outreach leads:\n` +
          `• Whop: ${breakdown.whop} fresh leads\n` +
          `• YouTube: ${breakdown.youtube} fresh leads\n` +
          `• Skool: ${breakdown.skool} fresh leads\n` +
          `• Instagram: ${breakdown.instagram} fresh leads\n\n` +
          `Duplicates from previous runs have been automatically filtered out and stored in Supabase!`
        );
      }
      
    } catch (err: any) {
      console.error(err);
      alert("Failed to complete omni-search: " + err.message);
    } finally {
      setLoading(false);
      setProgress("");
    }
  };
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
          <h1 className="page-title animate-in">
            <span className="page-title-gradient">NicheScope</span>
          </h1>
          <p className="page-subtitle animate-in delay-1">
            Your coaching niche intelligence platform — scrape, analyze, and
            dominate.
          </p>

          {/* Omni Search */}
          <div className="search-container animate-in delay-2" style={{ marginBottom: "2rem", marginTop: "1rem" }}>
            <div className="search-bar">
              <div className="search-input-wrapper">
                <span className="search-input-icon">/</span>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Omni-Search: Enter a niche to scrape ALL platforms and export as CSV..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleOmniSearch()}
                />
              </div>
              <button
                className="search-btn"
                style={{ background: "#111111", padding: "12px 24px", whiteSpace: "nowrap" }}
                onClick={handleOmniSearch}
                disabled={loading || !query.trim()}
              >
                {loading ? progress : "Do All & Export CSV"}
              </button>
            </div>
            {loading && (
              <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
                <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                <span>Please wait... {progress} (This process scans 3 platforms and extracts all contact info in the background)</span>
              </div>
            )}
          </div>

          <div className="bento-grid">
            {/* YouTube Card */}
            <Link href="/youtube" style={{ textDecoration: "none" }}>
              <div className="stat-card animate-in delay-2" style={{ cursor: "pointer", minHeight: 180 }}>
                <div style={{ fontSize: 20, marginBottom: 12, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: "#111" }}>YT</div>
                <div className="stat-card-value purple">YouTube</div>
                <div className="stat-card-detail" style={{ marginTop: 8, lineHeight: 1.5 }}>
                  Search coaching channels, analyze video performance, compare
                  engagement metrics, and discover niche opportunities.
                </div>
                <div style={{
                  marginTop: 12, fontSize: 12, fontWeight: 600,
                  color: "var(--accent-purple)",
                }}>
                  Ready to use →
                </div>
              </div>
            </Link>

            {/* Whop Card */}
            <Link href="/whop" style={{ textDecoration: "none" }}>
              <div className="stat-card animate-in delay-3" style={{ cursor: "pointer", minHeight: 180 }}>
                <div style={{ fontSize: 20, marginBottom: 12, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: "#111" }}>W</div>
                <div className="stat-card-value cyan">Whop</div>
                <div className="stat-card-detail" style={{ marginTop: 8, lineHeight: 1.5 }}>
                  Scrape coaching products, pricing, and reviews from the Whop
                  marketplace. Competitive intelligence for digital products.
                </div>
                <div style={{
                  marginTop: 12, fontSize: 12, fontWeight: 600,
                  color: "var(--accent-cyan)",
                }}>
                  Ready to use →
                </div>
              </div>
            </Link>

            {/* Skool Card */}
            <Link href="/skool" style={{ textDecoration: "none" }}>
              <div className="stat-card animate-in delay-4" style={{ cursor: "pointer", minHeight: 180 }}>
                <div style={{ fontSize: 20, marginBottom: 12, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: "#111" }}>SK</div>
                <div className="stat-card-value green">Skool</div>
                <div className="stat-card-detail" style={{ marginTop: 8, lineHeight: 1.5 }}>
                  Discover coaching communities, member counts, pricing, and growth
                  trends from the Skool discovery page.
                </div>
                <div style={{
                  marginTop: 12, fontSize: 12, fontWeight: 600,
                  color: "var(--accent-green)",
                }}>
                  Ready to use →
                </div>
              </div>
            </Link>

            {/* Instagram Card */}
            <Link href="/instagram" style={{ textDecoration: "none" }}>
              <div className="stat-card animate-in delay-5" style={{ cursor: "pointer", minHeight: 180 }}>
                <div style={{ fontSize: 20, marginBottom: 12, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: "#111" }}>IG</div>
                <div className="stat-card-value pink" style={{ color: "#ec4899" }}>Instagram</div>
                <div className="stat-card-detail" style={{ marginTop: 8, lineHeight: 1.5 }}>
                  Search for highly targeted Instagram leads using advanced search engine
                  dorking syntax to safely extract email addresses.
                </div>
                <div style={{
                  marginTop: 12, fontSize: 12, fontWeight: 600,
                  color: "#ec4899",
                }}>
                  Ready to use →
                </div>
              </div>
            </Link>

            {/* AI Insights Card */}
            <div className="stat-card animate-in delay-6" style={{ minHeight: 180, opacity: 0.6 }}>
              <div style={{ fontSize: 20, marginBottom: 12, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: "#999" }}>AI</div>
              <div className="stat-card-value orange">AI Insights</div>
              <div className="stat-card-detail" style={{ marginTop: 8, lineHeight: 1.5 }}>
                AI-powered analysis to find underserved niches, content gaps,
                and opportunities across all platforms.
              </div>
              <div style={{
                marginTop: 12, fontSize: 12, fontWeight: 600,
                color: "var(--text-muted)",
              }}>
                Coming soon
              </div>
            </div>
          </div>

          {/* Quick tips */}
          <div className="chart-container animate-in delay-5">
            <div className="chart-title" style={{ marginBottom: 16 }}>Getting Started</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8 }}>
              <div><strong style={{ color: "var(--accent-purple)" }}>1.</strong> Head to the <strong>YouTube</strong> scraper from the sidebar</div>
              <div><strong style={{ color: "var(--accent-cyan)" }}>2.</strong> Enter a coaching niche keyword (e.g. &quot;online coaching&quot;, &quot;business mentorship&quot;)</div>
              <div><strong style={{ color: "var(--accent-green)" }}>3.</strong> Analyze channels, videos, and engagement metrics instantly</div>
              <div><strong style={{ color: "var(--accent-orange)" }}>4.</strong> Click &quot;View Videos&quot; on any channel to drill into their content</div>
              <div><strong style={{ color: "var(--accent-pink)" }}>5.</strong> Sort by any column to find the highest-performing content</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
