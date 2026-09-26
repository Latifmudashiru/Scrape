"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";

interface Lead {
  id: string;
  platform: string;
  name: string;
  link: string;
  description: string;
  price: string;
  audience_size: string;
  emails: string;
  socials: string;
  igUsername: string | null;
  is_messaged: boolean;
  messaged_at: string | null;
  message_sent: string | null;
  outreach_error: string | null;
}

interface CampaignLog {
  timestamp: string;
  status: "info" | "sending" | "success" | "failed" | "delay" | "error" | "complete";
  message: string;
}

export default function OutreachPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  
  // Settings
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [niche, setNiche] = useState("business coaching");
  const [customPrompt, setCustomPrompt] = useState("");
  
  // Filters
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [hasIgFilter, setHasIgFilter] = useState(true); // default true to show actionable leads

  // Execution State
  const [campaignRunning, setCampaignRunning] = useState(false);
  const [campaignLogs, setCampaignLogs] = useState<CampaignLog[]>([]);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [browserOpening, setBrowserOpening] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load API Key and Leads
  useEffect(() => {
    const savedKey = localStorage.getItem("nic_gemini_api_key") || "";
    setGeminiApiKey(savedKey);

    const savedPrompt = localStorage.getItem("nic_outreach_prompt") || "";
    setCustomPrompt(savedPrompt);

    fetchLeads();
  }, []);

  // Filter logic
  useEffect(() => {
    let result = [...leads];
    
    if (platformFilter !== "all") {
      result = result.filter(l => l.platform.toLowerCase() === platformFilter.toLowerCase());
    }
    
    if (statusFilter !== "all") {
      if (statusFilter === "messaged") {
        result = result.filter(l => l.is_messaged);
      } else if (statusFilter === "pending") {
        result = result.filter(l => !l.is_messaged);
      } else if (statusFilter === "failed") {
        result = result.filter(l => l.outreach_error);
      }
    }
    
    if (hasIgFilter) {
      result = result.filter(l => l.igUsername !== null);
    }
    
    setFilteredLeads(result);
  }, [leads, platformFilter, statusFilter, hasIgFilter]);

  // Scroll to bottom of logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [campaignLogs]);

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const res = await fetch("/api/outreach/leads");
      const data = await res.json();
      if (data.success) {
        setLeads(data.data || []);
      } else {
        alert("Failed to load leads: " + data.error);
      }
    } catch (e: any) {
      console.error(e);
      alert("Error loading leads: " + e.message);
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleSaveApiKey = () => {
    localStorage.setItem("nic_gemini_api_key", geminiApiKey);
    alert("Gemini API Key saved locally!");
  };

  const handleSavePrompt = () => {
    localStorage.setItem("nic_outreach_prompt", customPrompt);
    alert("Outreach prompt template saved!");
  };

  const handleOpenLogin = async () => {
    setBrowserOpening(true);
    try {
      const res = await fetch("/api/outreach/login", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Puppeteer launched. Please review the open browser window on your desktop to ensure you are logged into Instagram.");
      } else {
        alert("Failed to open browser: " + data.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setBrowserOpening(false);
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const actionable = filteredLeads.filter(l => l.igUsername);
    if (selectedLeadIds.length === actionable.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(actionable.map(l => l.id));
    }
  };

  const addLog = (status: CampaignLog["status"], message: string) => {
    setCampaignLogs(prev => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), status, message }
    ]);
  };

  const startCampaign = async () => {
    if (selectedLeadIds.length === 0) {
      alert("Please select at least one lead to message.");
      return;
    }
    // Key validation is handled server-side (which checks for .env.local OPENAI_API_KEY or GEMINI_API_KEY)

    setCampaignRunning(true);
    setCampaignLogs([]);
    setCountdownRemaining(null);
    addLog("info", `Starting outreach campaign on ${selectedLeadIds.length} leads...`);

    try {
      const response = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          niche,
          customPrompt: customPrompt.trim() || undefined,
          geminiApiKey: geminiApiKey.trim()
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Server responded with an error");
      }

      if (!response.body) {
        throw new Error("No response stream available");
      }

      const reader = response.body.getReader();
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
              
              if (data.status === "info") {
                addLog("info", data.message);
              } else if (data.status === "sending") {
                addLog("sending", data.message);
              } else if (data.status === "success") {
                addLog("success", data.message);
                // Update local list state
                setLeads(prevLeads =>
                  prevLeads.map(l =>
                    l.id === data.leadId
                      ? { ...l, is_messaged: true, message_sent: data.message }
                      : l
                  )
                );
              } else if (data.status === "failed") {
                addLog("failed", data.message);
                setLeads(prevLeads =>
                  prevLeads.map(l =>
                    l.id === data.leadId
                      ? { ...l, outreach_error: data.message }
                      : l
                  )
                );
              } else if (data.status === "delay") {
                addLog("delay", data.message);
              } else if (data.status === "delay-countdown") {
                setCountdownRemaining(data.remaining);
              } else if (data.status === "error") {
                addLog("error", data.message);
              } else if (data.status === "complete") {
                addLog("complete", data.message);
                setCountdownRemaining(null);
              }
            } catch (err) {
              console.error("Error parsing event JSON:", rawJson, err);
            }
          }
        }
      }
    } catch (e: any) {
      addLog("error", "Campaign execution failed: " + e.message);
    } finally {
      setCampaignRunning(false);
      setCountdownRemaining(null);
      fetchLeads(); // Refresh leads status
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
          <h1 className="page-title animate-in">
            <span className="page-title-gradient" style={{ backgroundImage: "linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)" }}>Outreach</span> Automator
          </h1>
          <p className="page-subtitle animate-in delay-1">
            Automate Instagram direct message outreach. Personalize templates with OpenAI or Gemini AI and safely send DMs via local Puppeteer automation.
          </p>

          {/* Config Grid */}
          <div className="bento-grid animate-in delay-2" style={{ marginBottom: "2rem" }}>
            
            {/* API settings */}
            <div className="stat-card" style={{ minHeight: "auto" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}> AI Model API Settings</div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                Drafts personalized messages. (OpenAI `OPENAI_API_KEY` in `.env.local` is used automatically if present).
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="password"
                  placeholder="Enter Gemini API Key (saved locally)"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "white",
                    fontSize: 13
                  }}
                />
                <button
                  className="search-btn"
                  onClick={handleSaveApiKey}
                  style={{ padding: "8px 16px", background: "var(--accent-purple)", minHeight: "auto" }}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Instagram login settings */}
            <div className="stat-card" style={{ minHeight: "auto" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}> Instagram Session</div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                Must log in to Instagram first. Keeps session saved in local user directory.
              </p>
              <button
                className="search-btn"
                onClick={handleOpenLogin}
                disabled={browserOpening || campaignRunning}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
                  minHeight: "auto",
                  opacity: browserOpening ? 0.7 : 1
                }}
              >
                {browserOpening ? "Opening Browser..." : " Open Instagram to Login"}
              </button>
            </div>
          </div>

          {/* Prompt Template Card */}
          <div className="chart-container animate-in delay-3" style={{ marginBottom: "2rem", padding: "20px" }}>
            <div className="chart-title" style={{ marginBottom: "8px" }}> Personalized Prompt Prompt Template</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: "12px" }}>
              Tailor the AI outreach prompt. Placeholders: <code style={{ color: "#a78bfa" }}>{"{platform}"}</code>, <code style={{ color: "#a78bfa" }}>{"{name}"}</code>, <code style={{ color: "#a78bfa" }}>{"{niche}"}</code>, <code style={{ color: "#a78bfa" }}>{"{description}"}</code>, <code style={{ color: "#a78bfa" }}>{"{socials}"}</code>.
            </p>
            <textarea
              rows={4}
              placeholder="Leave blank to use the default optimized prompt template..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "10px 12px",
                color: "white",
                fontSize: 13,
                fontFamily: "inherit",
                resize: "vertical",
                marginBottom: "12px"
              }}
            />
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{ flex: 1, display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Campaign Niche:</span>
                <input
                  type="text"
                  placeholder="e.g. fitness, trading, business coach"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "6px 12px",
                    color: "white",
                    fontSize: 13,
                    width: "200px"
                  }}
                />
              </div>
              <button
                className="search-btn"
                onClick={handleSavePrompt}
                style={{ padding: "8px 16px", background: "var(--accent-purple)", minHeight: "auto" }}
              >
                Save Prompt Template
              </button>
            </div>
          </div>

          {/* Campaign Runner Output */}
          {campaignLogs.length > 0 && (
            <div className="chart-container animate-in" style={{ marginBottom: "2rem", border: "1px solid rgba(139, 92, 246, 0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div className="chart-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span> Campaign Execution Console</span>
                  {campaignRunning && <div className="loading-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
                </div>
                {countdownRemaining !== null && (
                  <div style={{ fontSize: 13, background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "2px 8px", borderRadius: 4, fontWeight: "600" }}>
                    ⏳ Anti-detection hold: {countdownRemaining}s
                  </div>
                )}
              </div>
              <div
                style={{
                  height: "220px",
                  overflowY: "auto",
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: 6,
                  padding: "12px",
                  fontFamily: "monospace",
                  fontSize: 12,
                  lineHeight: 1.6,
                  border: "1px solid rgba(255,255,255,0.05)"
                }}
              >
                {campaignLogs.map((log, i) => (
                  <div
                    key={i}
                    style={{
                      color:
                        log.status === "success"
                          ? "#34d399"
                          : log.status === "failed" || log.status === "error"
                          ? "#f87171"
                          : log.status === "sending"
                          ? "#fbbf24"
                          : log.status === "delay"
                          ? "#a78bfa"
                          : "var(--text-secondary)",
                      marginBottom: "4px"
                    }}
                  >
                    [{log.timestamp}] {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* Leads Section */}
          <div className="data-table-container animate-in delay-4">
            <div className="data-table-header" style={{ display: "flex", flexWrap: "wrap", gap: "16px", padding: "16px 20px" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div className="data-table-title"> Campaign Audience Queue</div>
                <div className="data-table-count" style={{ marginTop: 4 }}>
                  {filteredLeads.length} leads matching filters ({selectedLeadIds.length} selected)
                </div>
              </div>
              
              {/* Campaign triggers */}
              {selectedLeadIds.length > 0 && (
                <button
                  className="search-btn"
                  onClick={startCampaign}
                  disabled={campaignRunning}
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    padding: "10px 20px",
                    fontWeight: 600,
                    minHeight: "auto",
                    boxShadow: "0 0 15px rgba(16, 185, 129, 0.4)"
                  }}
                >
                   Run Campaign ({selectedLeadIds.length} DMs)
                </button>
              )}
            </div>

            {/* Filters */}
            <div
              style={{
                display: "flex",
                gap: "16px",
                padding: "12px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                flexWrap: "wrap",
                background: "rgba(255,255,255,0.01)",
                fontSize: 13
              }}
            >
              {/* Platform */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Platform:</span>
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  style={{ background: "rgba(0,0,0,0.3)", color: "white", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 8px" }}
                >
                  <option value="all">All</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="whop">Whop</option>
                  <option value="skool">Skool</option>
                </select>
              </div>

              {/* Status */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ background: "rgba(0,0,0,0.3)", color: "white", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 8px" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Outreach</option>
                  <option value="messaged">Messaged</option>
                  <option value="failed">Failed / Error</option>
                </select>
              </div>

              {/* Has IG Handle Toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="checkbox"
                  id="hasIgFilter"
                  checked={hasIgFilter}
                  onChange={(e) => setHasIgFilter(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="hasIgFilter" style={{ color: "var(--text-muted)", cursor: "pointer", userSelect: "none" }}>
                  Has Instagram username only (actionable)
                </label>
              </div>
            </div>

            {loadingLeads ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
                <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Fetching leads and outreach history...</div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
                No leads found matching your criteria. Try loosening your filters or scrape new leads first!
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "40px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={
                            filteredLeads.filter(l => l.igUsername).length > 0 &&
                            selectedLeadIds.length === filteredLeads.filter(l => l.igUsername).length
                          }
                          onChange={toggleSelectAll}
                          disabled={campaignRunning}
                          style={{ cursor: "pointer" }}
                        />
                      </th>
                      <th>Name / Platform</th>
                      <th>IG Account</th>
                      <th>Emails</th>
                      <th>Outreach Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => {
                      const isSelectable = lead.igUsername !== null;
                      const isChecked = selectedLeadIds.includes(lead.id);
                      
                      return (
                        <tr key={lead.id} style={{ opacity: isSelectable ? 1 : 0.5 }}>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectLead(lead.id)}
                              disabled={!isSelectable || campaignRunning}
                              style={{ cursor: isSelectable ? "pointer" : "not-allowed" }}
                            />
                          </td>
                          <td>
                            <div>
                              <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>{lead.name}</div>
                              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                <span style={{
                                  fontSize: 10,
                                  background:
                                    lead.platform === "YouTube"
                                      ? "rgba(239, 68, 68, 0.15)"
                                      : lead.platform === "Whop"
                                      ? "rgba(6, 182, 212, 0.15)"
                                      : lead.platform === "Skool"
                                      ? "rgba(16, 185, 129, 0.15)"
                                      : "rgba(236, 72, 153, 0.15)",
                                  color:
                                    lead.platform === "YouTube"
                                      ? "#ef4444"
                                      : lead.platform === "Whop"
                                      ? "#06b6d4"
                                      : lead.platform === "Skool"
                                      ? "#10b981"
                                      : "#ec4899",
                                  padding: "2px 6px",
                                  borderRadius: 4
                                }}>
                                  {lead.platform}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {lead.igUsername ? (
                              <a
                                href={`https://instagram.com/${lead.igUsername}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 500 }}
                              >
                                @{lead.igUsername} ↗
                              </a>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>
                                Not Found
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                              {lead.emails ? (
                                <span style={{ color: "#34d399" }}> {lead.emails}</span>
                              ) : (
                                <span style={{ color: "var(--text-muted)" }}>-</span>
                              )}
                            </div>
                          </td>
                          <td>
                            {lead.is_messaged ? (
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ color: "#34d399", fontWeight: "600", fontSize: 13 }}>
                                   Messaged
                                </span>
                                {lead.messaged_at && (
                                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                    {new Date(lead.messaged_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            ) : lead.outreach_error ? (
                              <span style={{ color: "#f87171", fontSize: 12 }} title={lead.outreach_error}>
                                 Error: {lead.outreach_error.substring(0, 30)}...
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                                Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
