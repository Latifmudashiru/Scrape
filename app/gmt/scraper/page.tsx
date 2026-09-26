"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";

interface ScrapedLead {
  platform: string;
  name: string;
  link: string;
  description: string;
  price: string;
  audience_size: string;
  emails: string;
  socials: string;
  alreadySaved?: boolean;
}

interface ScrapeLog {
  timestamp: string;
  status: "info" | "success" | "warning" | "error" | "complete";
  message: string;
}

export default function GMTScraperPage() {
  const [location, setLocation] = useState("Manchester");
  const [keyword, setKeyword] = useState("cleaning company");
  const [maxResults, setMaxResults] = useState(20);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [scrapeLogs, setScrapeLogs] = useState<ScrapeLog[]>([]);
  const [scrapedLeads, setScrapedLeads] = useState<ScrapedLead[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [pushingAll, setPushingAll] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("crm_user");
    if (stored) {
      setCurrentUser(JSON.parse(stored).name);
    }
  }, []);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAllLeads();
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [scrapeLogs]);

  const fetchAllLeads = async () => {
    try {
      const res = await fetch("/api/gmt/leads");
      const data = await res.json();
      if (data.success) {
        const mapped = (data.data || []).map((l: any) => ({
          platform: l.platform,
          name: l.name,
          link: l.link,
          description: l.description,
          price: l.price,
          audience_size: l.audience_size,
          emails: l.emails,
          socials: l.socials,
          alreadySaved: l.is_pushed,
          scraped_by: l.scraped_by
        }));
        setScrapedLeads(mapped);
      }
    } catch (e) {
      console.error("Error fetching database leads:", e);
    }
  };

  const addLog = (status: ScrapeLog["status"], message: string) => {
    setScrapeLogs((prev) => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), status, message },
    ]);
  };

  const handleScrape = async () => {
    if (!location.trim() || !keyword.trim()) return;
    setLoading(true);
    setScrapeLogs([]);
    addLog("info", `Starting Google Maps search for "${keyword}" in "${location}"...`);

    try {
      const res = await fetch("/api/gmt/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: keyword.trim(),
          location: location.trim(),
          maxResults,
          scrapedBy: currentUser || null
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Server error running scraper");
      }

      if (!res.body) throw new Error("No response log stream available");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const events = text.split("\n\n").filter(Boolean);
        for (const event of events) {
          if (event.startsWith("data: ")) {
            const rawJson = event.replace("data: ", "").trim();
            try {
              const data = JSON.parse(rawJson);
              
              if (data.status === "complete") {
                addLog("complete", "Scrape process complete! Reloading database records...");
                setProgress("");
              } else {
                addLog(data.status, data.message);
                setProgress(data.message);
              }
            } catch (err) {
              console.error("Error parsing event JSON:", rawJson, err);
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      addLog("error", "Scrape failed: " + err.message);
    } finally {
      setLoading(false);
      setProgress("");
      await fetchAllLeads(); // Reload the database to display all new leads
    }
  };

  const handlePushLead = async (lead: ScrapedLead) => {
    setPushingId(lead.link);
    try {
      const res = await fetch("/api/gmt/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "push",
          leadLinks: [lead.link]
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScrapedLeads((prev) =>
          prev.map((l) => (l.link === lead.link ? { ...l, alreadySaved: true } : l))
        );
      } else {
        alert("Push failed: " + data.error);
      }
    } catch (err: any) {
      alert("Error pushing lead: " + err.message);
    } finally {
      setPushingId(null);
    }
  };

  const handlePushAll = async () => {
    const unpushedLeads = filteredLeads.filter(l => !l.alreadySaved);
    if (unpushedLeads.length === 0) return;

    setPushingAll(true);
    try {
      const res = await fetch("/api/gmt/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "push",
          leadLinks: unpushedLeads.map(l => l.link)
        }),
      });
      const data = await res.json();
      if (data.success) {
        const pushedLinks = new Set(unpushedLeads.map(l => l.link));
        setScrapedLeads((prev) =>
          prev.map((l) => (pushedLinks.has(l.link) ? { ...l, alreadySaved: true } : l))
        );
        alert(`Successfully pushed ${unpushedLeads.length} leads to Lead List!`);
      } else {
        alert("Push failed: " + data.error);
      }
    } catch (err: any) {
      alert("Error pushing all leads: " + err.message);
    } finally {
      setPushingAll(false);
    }
  };

  // Parsers
  const parsePhone = (socials: string): string => {
    const match = socials.match(/Phone:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
    return match ? match[1] : "";
  };

  const parseWebsite = (socials: string): string => {
    const match = socials.match(/Website:\s*([^\s|]+)/i);
    return match && match[1] !== "N/A" ? match[1] : "";
  };

  const parseCategory = (desc: string): string => {
    const match = desc.match(/Category:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
    return match ? match[1] : "Cleaning Company";
  };

  const parseAddress = (desc: string): string => {
    const match = desc.match(/Address:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
    return match ? match[1] : "";
  };

  const parseRating = (desc: string): string => {
    const match = desc.match(/Rating:\s*([^\s|]+(?:\s+\([\d,]+\s+\w+\))?)/i);
    return match ? match[1] : "";
  };

  const parseDirector = (desc: string): string => {
    const match = desc.match(/Director:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
    return match ? match[1] : "Not Found";
  };

  const s = {
    label: {
      fontSize: "12px",
      fontWeight: 600,
      color: "#888888",
      textTransform: "uppercase" as const,
      letterSpacing: "0.5px",
      marginBottom: "6px",
    },
    input: {
      width: "100%",
      padding: "8px 12px",
      border: "1px solid #e5e5e5",
      borderRadius: "6px",
      fontSize: "13px",
      fontFamily: "'Inter', sans-serif",
      background: "#fafafa",
      color: "#111111",
      outline: "none",
    },
    select: {
      width: "100%",
      padding: "8px 12px",
      border: "1px solid #e5e5e5",
      borderRadius: "6px",
      fontSize: "13px",
      fontFamily: "'Inter', sans-serif",
      background: "#fafafa",
      color: "#111111",
      cursor: "pointer",
    }
  };

  const filteredLeads = scrapedLeads.filter(l => {
    // Hide leads scraped by other team members
    if (l.scraped_by && l.scraped_by !== currentUser) return false;

    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.socials.toLowerCase().includes(q)
    );
  });

  const newLeadsCount = filteredLeads.filter(l => !l.alreadySaved).length;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
          <h1 className="page-title animate-in">
            <span className="page-title-gradient">GMT Solutions</span> Lead Scraper
          </h1>
          <p className="page-subtitle animate-in delay-1">
            Scrape target locations for cleaning companies, extract Companies House Director names, and push fresh leads to your official Lead List.
          </p>

          {/* Scrape Controls */}
          <div
            className="animate-in delay-2"
            style={{
              marginBottom: "32px",
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              padding: "24px",
            }}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: 600,
                fontFamily: "'Space Grotesk', sans-serif",
                marginBottom: "16px",
              }}
            >
              Scrape Target Markets
            </div>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "220px" }}>
                <div style={s.label}>Location / Area</div>
                <input
                  id="target-location-input"
                  style={s.input}
                  type="text"
                  placeholder="e.g. Manchester, London"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div style={{ flex: 1, minWidth: "220px" }}>
                <div style={s.label}>Business Keyword</div>
                <select
                  id="target-keyword-input"
                  style={s.select}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                >
                  <option value="cleaning company">Cleaning Company</option>
                  <option value="house cleaning">House Cleaning</option>
                  <option value="commercial cleaning">Commercial Cleaning</option>
                  <option value="office cleaning">Office Cleaning</option>
                  <option value="carpet cleaning">Carpet Cleaning</option>
                </select>
              </div>
              <div style={{ width: "120px" }}>
                <div style={s.label}>Max Results</div>
                <input
                  id="target-max-input"
                  style={s.input}
                  type="number"
                  min="5"
                  max="100"
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "20px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#999999" }}>
                Automatically cross-references against Companies House using SIC business classification codes.
              </div>
              <button
                id="start-scrape-btn"
                className="search-btn"
                onClick={handleScrape}
                disabled={loading || !location.trim()}
              >
                {loading ? "Scraping..." : "Scrape Google Maps"}
              </button>
            </div>
          </div>

          {/* Console Logs */}
          {scrapeLogs.length > 0 && (
            <div
              className="animate-in"
              style={{
                marginBottom: "32px",
                background: "#111111",
                borderRadius: "8px",
                padding: "20px",
                border: "1px solid #333333",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#888888",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>Scraper Console</span>
                  {loading && (
                    <div
                      className="loading-spinner"
                      style={{
                        width: 12,
                        height: 12,
                        borderWidth: 2,
                        borderColor: "#333",
                        borderTopColor: "#ffffff",
                      }}
                    />
                  )}
                </div>
              </div>
              <div
                style={{
                  height: "160px",
                  overflowY: "auto",
                  fontFamily: "'SF Mono', 'Consolas', monospace",
                  fontSize: "12px",
                  lineHeight: 1.7,
                  color: "#cccccc",
                }}
              >
                {scrapeLogs.map((log, i) => (
                  <div
                    key={i}
                    style={{
                      color:
                        log.status === "success"
                          ? "#4ade80"
                          : log.status === "error"
                          ? "#f87171"
                          : log.status === "warning"
                          ? "#fbbf24"
                          : log.status === "complete"
                          ? "#ffffff"
                          : "#888888",
                      marginBottom: "2px",
                    }}
                  >
                    <span style={{ color: "#555555" }}>[{log.timestamp}]</span>{" "}
                    {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* Results Table */}
          {scrapedLeads.length > 0 && (
            <div
              className="animate-in"
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              {/* Header Bar */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #e5e5e5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px"
                }}
              >
                <div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 600 }}>
                    Scraped Results
                  </div>
                  <div style={{ fontSize: "12px", color: "#999999", marginTop: "2px" }}>
                    {filteredLeads.length} leads shown ({newLeadsCount} new/unpushed)
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    style={{
                      width: "200px",
                      height: "34px",
                      padding: "6px 12px",
                      border: "1px solid #e5e5e5",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontFamily: "'Inter', sans-serif",
                      background: "#fafafa",
                      color: "#111111",
                      outline: "none"
                    }}
                    type="text"
                    placeholder="Search scraped leads..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />

                  {newLeadsCount > 0 && (
                    <button
                      onClick={handlePushAll}
                      disabled={pushingAll}
                      style={{
                        padding: "8px 16px",
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      {pushingAll ? "Pushing..." : `Push All New Leads (${newLeadsCount})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>Category</th>
                      <th>Phone</th>
                      <th>Companies House Director</th>
                      <th style={{ width: "160px", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead, i) => {
                      const phone = parsePhone(lead.socials);
                      const category = parseCategory(lead.description);
                      const address = parseAddress(lead.description);
                      const rating = parseRating(lead.description);
                      const website = parseWebsite(lead.socials);
                      const director = parseDirector(lead.description);
                      const isPushing = pushingId === lead.link;
                      const isSaved = lead.alreadySaved;

                      return (
                        <tr key={i}>
                          <td>
                            <div style={{ fontWeight: 600, color: "#111111" }}>{lead.name}</div>
                            <div style={{ fontSize: "11px", color: "#777", marginTop: "2px" }}>{address}</div>
                            {website && (
                              <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#059669", textDecoration: "none", display: "inline-block", marginTop: "4px" }}>
                                {website} ↗
                              </a>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: "12px" }}>{category}</span>
                            <div style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}>Rating: {rating}</div>
                          </td>
                          <td>{phone || <span style={{ color: "#bbb" }}>None</span>}</td>
                          <td>
                            <span style={{
                              fontSize: "12px",
                              color: director === "Not Found" ? "#777" : "#059669",
                              fontWeight: director === "Not Found" ? "400" : "600"
                            }}>
                              {director}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              disabled={isSaved || isPushing}
                              onClick={() => handlePushLead(lead)}
                              style={{
                                padding: "6px 12px",
                                border: isSaved ? "1px solid #e5e5e5" : "1px solid #10b981",
                                borderRadius: "6px",
                                background: isSaved ? "#fafafa" : "#10b981",
                                color: isSaved ? "#888888" : "#ffffff",
                                fontSize: "12px",
                                fontWeight: 500,
                                cursor: isSaved ? "default" : "pointer"
                              }}
                            >
                              {isPushing ? "Pushing..." : isSaved ? "✓ Pushed" : "Push to Lead List"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
