"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

interface CRMData {
  called: boolean;
  caller: string;
  response: string;
  dateOutreached: string;
  notes: string;
  directors?: string[];
  companyUrl?: string;
  callbackTime?: string;
}

interface GMTLead {
  id: string;
  name: string;
  link: string;
  description: string;
  price: string;
  audience_size: string;
  emails: string; // JSON CRM blob
  socials: string;
  created_at: string;
  is_pushed?: boolean;
}

const emptyCRM: CRMData = {
  called: false,
  caller: "",
  response: "",
  dateOutreached: "",
  notes: "",
  directors: [],
  companyUrl: "",
  callbackTime: "",
};

function parseCRM(emails: string): CRMData {
  if (!emails) return { ...emptyCRM };
  try {
    const parsed = JSON.parse(emails);
    return {
      called: parsed.called || false,
      caller: parsed.caller || "",
      response: parsed.response || "",
      dateOutreached: parsed.dateOutreached || "",
      notes: parsed.notes || "",
      directors: parsed.directors || [],
      companyUrl: parsed.companyUrl || "",
      callbackTime: parsed.callbackTime || "",
    };
  } catch {
    return { ...emptyCRM, notes: emails };
  }
}

export default function GMTTasksPage() {
  const [leads, setLeads] = useState<GMTLead[]>([]);
  const [loading, setLoading] = useState(true);

  // For quick edits
  const [statusState, setStatusState] = useState<Record<string, string>>({});
  const [crmState, setCrmState] = useState<Record<string, CRMData>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"today" | "overdue" | "upcoming">("today");

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gmt/leads");
      const data = await res.json();
      if (data.success) {
        setLeads(data.data || []);
        
        const initialCRM: Record<string, CRMData> = {};
        const initialStatus: Record<string, string> = {};
        (data.data || []).forEach((l: GMTLead) => {
          initialCRM[l.id] = parseCRM(l.emails);
          initialStatus[l.id] = l.price || "Pending";
        });
        setCrmState(initialCRM);
        setStatusState(initialStatus);
      }
    } catch (e: any) {
      console.error("Error loading leads:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCRM = (leadId: string, field: keyof CRMData, value: any) => {
    setCrmState((prev) => {
      const current = prev[leadId] || { ...emptyCRM };
      return {
        ...prev,
        [leadId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleSaveLead = async (leadId: string) => {
    setSavingId(leadId);
    const status = statusState[leadId] || "Pending";
    const crm = crmState[leadId] || { ...emptyCRM };

    const storedUser = localStorage.getItem("crm_user");
    if (storedUser) {
      crm.caller = JSON.parse(storedUser).name;
    }

    if (!crm.dateOutreached) {
      crm.dateOutreached = new Date().toISOString().split("T")[0];
    }

    try {
      const res = await fetch("/api/gmt/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status, crmData: crm }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh leads list to propagate pipeline movements
        await fetchLeads();
      } else {
        alert("Failed to save: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving: " + err.message);
    } finally {
      setSavingId(null);
    }
  };

  // Helper parsers
  const parsePhone = (socials: string): string => {
    const match = socials.match(/Phone:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
    return match ? match[1] : "N/A";
  };

  const parseWebsite = (socials: string): string => {
    const match = socials.match(/Website:\s*([^\s|]+)/i);
    return match && match[1] !== "N/A" ? match[1] : "";
  };

  // Filter tasks
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

  // Leads with status "Call Later" and a callbackTime set
  const taskLeads = leads.filter((l) => {
    const crm = parseCRM(l.emails);
    return l.price === "Call Later" && crm.callbackTime;
  });

  const getCategorizedTasks = () => {
    const overdueList: GMTLead[] = [];
    const todayList: GMTLead[] = [];
    const upcomingList: GMTLead[] = [];

    taskLeads.forEach((l) => {
      const crm = parseCRM(l.emails);
      if (!crm.callbackTime) return;

      const callbackDate = new Date(crm.callbackTime);
      const callbackDayStr = callbackDate.toISOString().split("T")[0];

      if (callbackDate < now && callbackDayStr !== todayStr) {
        overdueList.push(l);
      } else if (callbackDayStr === todayStr) {
        todayList.push(l);
      } else {
        upcomingList.push(l);
      }
    });

    return { overdueList, todayList, upcomingList };
  };

  const { overdueList, todayList, upcomingList } = getCategorizedTasks();

  const getActiveList = () => {
    if (activeTab === "overdue") return overdueList;
    if (activeTab === "upcoming") return upcomingList;
    return todayList;
  };

  const activeLeads = getActiveList();

  const formatCallbackTime = (isoString: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " at " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoString;
    }
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
    },
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
           <h1 className="page-title animate-in">
            <span className="page-title-gradient">Follow Ups</span> & Callbacks
          </h1>
          <p className="page-subtitle animate-in delay-1">
            Track and manage scheduled callbacks. Keep your cold caller, Ola, aligned with follow ups.
          </p>

          {/* Quick Stats Grid */}
          <div className="stats-grid animate-in delay-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <div className="stat-card" style={{ borderLeft: "4px solid #ef4444", background: "rgba(239, 68, 68, 0.02)" }}>
              <div className="stat-card-label" style={{ color: "#ef4444" }}>Overdue Callbacks</div>
              <div className="stat-card-value" style={{ color: "#ef4444" }}>{overdueList.length}</div>
            </div>
            <div className="stat-card" style={{ borderLeft: "4px solid #f59e0b", background: "rgba(245, 158, 11, 0.02)" }}>
              <div className="stat-card-label" style={{ color: "#f59e0b" }}>Scheduled For Today</div>
              <div className="stat-card-value" style={{ color: "#f59e0b" }}>{todayList.length}</div>
            </div>
            <div className="stat-card" style={{ borderLeft: "4px solid #3b82f6", background: "rgba(59, 130, 246, 0.02)" }}>
              <div className="stat-card-label" style={{ color: "#3b82f6" }}>Upcoming Callbacks</div>
              <div className="stat-card-value" style={{ color: "#3b82f6" }}>{upcomingList.length}</div>
            </div>
          </div>

          {/* Tabs header */}
          <div className="animate-in delay-3" style={{ display: "flex", gap: "10px", borderBottom: "1px solid #e5e5e5", paddingBottom: "12px", marginBottom: "20px" }}>
            <button
              onClick={() => setActiveTab("today")}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                fontSize: "14px",
                fontWeight: 600,
                background: activeTab === "today" ? "rgba(109, 40, 217, 0.08)" : "transparent",
                color: activeTab === "today" ? "#6d28d9" : "#666",
                cursor: "pointer",
              }}
            >
              Today ({todayList.length})
            </button>
            <button
              onClick={() => setActiveTab("overdue")}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                fontSize: "14px",
                fontWeight: 600,
                background: activeTab === "overdue" ? "rgba(239, 68, 68, 0.08)" : "transparent",
                color: activeTab === "overdue" ? "#ef4444" : "#666",
                cursor: "pointer",
              }}
            >
              Overdue ({overdueList.length})
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                fontSize: "14px",
                fontWeight: 600,
                background: activeTab === "upcoming" ? "rgba(59, 130, 246, 0.08)" : "transparent",
                color: activeTab === "upcoming" ? "#3b82f6" : "#666",
                cursor: "pointer",
              }}
            >
              Upcoming ({upcomingList.length})
            </button>
          </div>

          {/* Task Board Cards */}
          <div className="animate-in delay-3" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
                <div style={{ color: "#999999", fontSize: 14 }}>Loading tasks...</div>
              </div>
            ) : activeLeads.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "48px 24px",
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                color: "#999999"
              }}>
                No callbacks scheduled for this tab.
              </div>
            ) : (
              activeLeads.map((lead) => {
                const phone = parsePhone(lead.socials);
                const website = parseWebsite(lead.socials);
                const crm = crmState[lead.id] || emptyCRM;
                const currentStatus = statusState[lead.id] || "Call Later";
                const isSaving = savingId === lead.id;

                return (
                  <div
                    key={lead.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5e5e5",
                      borderRadius: "8px",
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: 0 }}>{lead.name}</h3>
                        <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: 600, display: "inline-block", marginTop: "4px" }}>
                          Callback: {formatCallbackTime(crm.callbackTime || "")}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            style={{
                              padding: "6px 12px",
                              border: "1px solid #e5e5e5",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              textDecoration: "none",
                              color: "#333",
                              background: "#f9f9f9"
                            }}
                          >
                            Call: {phone}
                          </a>
                        )}
                        <a
                          href={lead.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "6px 12px",
                            border: "1px solid #e5e5e5",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            textDecoration: "none",
                            color: "#333",
                            background: "#f9f9f9"
                          }}
                        >
                          Google Maps
                        </a>
                      </div>
                    </div>

                    {/* Quick CRM updates */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", background: "#fbfbfb", padding: "16px", borderRadius: "6px", border: "1px solid #eee" }}>
                      <div>
                        <label style={s.label}>Outcome Status</label>
                        <select
                          value={currentStatus}
                          onChange={(e) => setStatusState((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                          style={s.select}
                        >
                          <option value="Pending" disabled hidden>Pending</option>
                          <option value="Call Later">Call Later</option>
                          <option value="Busy / No Answer">Busy / No Answer</option>
                          <option value="Not Interested">Not Interested</option>
                          <option value="Email Follow Up">Email Follow Up</option>
                          <option value="Text Follow Up">Text Follow Up</option>
                        </select>
                      </div>


                      {currentStatus === "Call Later" && (
                        <div>
                          <label style={s.label}>New Callback Time</label>
                          <input
                            type="datetime-local"
                            value={crm.callbackTime || ""}
                            onChange={(e) => handleUpdateCRM(lead.id, "callbackTime", e.target.value)}
                            style={s.input}
                          />
                        </div>
                      )}
                    </div>

                    {/* Notes & Save */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={s.label}>Call Notes</label>
                      <textarea
                        rows={2}
                        value={crm.notes}
                        onChange={(e) => handleUpdateCRM(lead.id, "notes", e.target.value)}
                        placeholder="Add details about the prospect, callback preference, etc."
                        style={{
                          width: "100%",
                          padding: "10px",
                          border: "1px solid #e5e5e5",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontFamily: "inherit",
                          outline: "none"
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => handleSaveLead(lead.id)}
                        disabled={isSaving}
                        style={{
                          padding: "8px 20px",
                          background: "linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(109, 40, 217, 0.15)"
                        }}
                      >
                        {isSaving ? "Saving Outcome..." : "Save Callback Outcome"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
