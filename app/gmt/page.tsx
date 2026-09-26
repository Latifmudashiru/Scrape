"use client";

import { useState, useEffect, useRef } from "react";
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
  scraped_by?: string | null;
}

interface ScrapeLog {
  timestamp: string;
  status: "info" | "success" | "warning" | "error" | "complete";
  message: string;
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
    // Legacy: plain text notes from before the JSON format
    return { ...emptyCRM, notes: emails };
  }
}

export default function GMTDashboardPage() {
  // CRM State
  const [leads, setLeads] = useState<GMTLead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<GMTLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  // Filters
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // CRM form state per lead
  const [crmState, setCrmState] = useState<Record<string, CRMData>>({});
  const [statusState, setStatusState] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>("");

  // Manual lead modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualDirector, setManualDirector] = useState("");
  const [manualWebsite, setManualWebsite] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [creatingManual, setCreatingManual] = useState(false);

  const handleAddManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName) {
      alert("Business name is required");
      return;
    }
    setCreatingManual(true);
    try {
      const res = await fetch("/api/gmt/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_manual",
          name: manualName,
          phone: manualPhone,
          director: manualDirector,
          website: manualWebsite,
          address: manualAddress,
          category: manualCategory,
          notes: manualNotes,
          scrapedBy: currentUser || null
        })
      });
      const data = await res.json();
      if (data.success) {
        setManualName("");
        setManualPhone("");
        setManualDirector("");
        setManualWebsite("");
        setManualAddress("");
        setManualCategory("");
        setManualNotes("");
        setShowManualModal(false);
        fetchLeads();
      } else {
        alert("Failed to create manual lead: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setCreatingManual(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    const stored = localStorage.getItem("crm_user");
    if (stored) {
      setCurrentUser(JSON.parse(stored).name);
    }
  }, []);

  useEffect(() => {
    // Only display leads that have been pushed to Lead List
    let result = leads.filter((l) => l.is_pushed === true);

    // Hide leads scraped by other team members in Lead List
    if (currentUser) {
      result = result.filter((l) => !l.scraped_by || l.scraped_by === currentUser);
    }

    if (statusFilter !== "all") {
      result = result.filter((l) => l.price === statusFilter);
    } else {
      // Default: Only show uncontacted leads (Pending)
      result = result.filter((l) => l.price === "Pending");
    }
    if (searchFilter.trim() !== "") {
      const q = searchFilter.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.socials.toLowerCase().includes(q)
      );
    }
    setFilteredLeads(result);
  }, [leads, statusFilter, searchFilter, currentUser]);

  const fetchLeads = async () => {
    setLoadingLeads(true);
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
      setLoadingLeads(false);
    }
  };

  const updateCRMField = (leadId: string, field: keyof CRMData, value: any) => {
    setCrmState((prev) => {
      const currentCRM = prev[leadId] || { ...emptyCRM };
      const updatedCRM = {
        ...currentCRM,
        [field]: value,
      };

      if (!updatedCRM.dateOutreached && (field === "caller" || field === "response" || field === "notes" || field === "called")) {
        updatedCRM.dateOutreached = new Date().toISOString().split("T")[0];
      }

      return {
        ...prev,
        [leadId]: updatedCRM,
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
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, price: status, emails: JSON.stringify(crm) }
              : l
          )
        );
      } else {
        alert("Failed to save: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving: " + err.message);
    } finally {
      setSavingId(null);
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

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLeads.length === 0) return;
    const headers = [
      "Business Name",
      "Category",
      "Phone",
      "Website",
      "Address",
      "Rating",
      "Status",
      "Called",
      "Caller",
      "Response",
      "Date Outreached",
      "Notes",
      "Maps URL",
    ];
    const rows = filteredLeads.map((l) => {
      const crm = crmState[l.id] || emptyCRM;
      return [
        `"${l.name.replace(/"/g, '""')}"`,
        `"${parseCategory(l.description)}"`,
        `"${parsePhone(l.socials)}"`,
        `"${parseWebsite(l.socials)}"`,
        `"${parseAddress(l.description)}"`,
        `"${parseRating(l.description)}"`,
        `"${statusState[l.id] || "Pending"}"`,
        crm.called ? "Yes" : "No",
        `"${crm.caller}"`,
        `"${crm.response.replace(/"/g, '""')}"`,
        `"${crm.dateOutreached}"`,
        `"${crm.notes.replace(/"/g, '""')}"`,
        l.link,
      ];
    });
    const csvContent =
      headers.join(",") + "\n" + rows.map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `gmt_leads_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats
  const stats = {
    total: leads.length,
    pending: leads.filter((l) => l.price === "Pending").length,
    called: leads.filter((l) => l.price !== "Pending").length,
    meetings: leads.filter((l) => l.price === "Meeting Scheduled").length,
  };

  // Inline styles
  const s = {
    label: {
      fontSize: "12px",
      fontWeight: 600 as const,
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
    textarea: {
      width: "100%",
      padding: "8px 12px",
      border: "1px solid #e5e5e5",
      borderRadius: "6px",
      fontSize: "13px",
      fontFamily: "'Inter', sans-serif",
      background: "#fafafa",
      color: "#111111",
      outline: "none",
      resize: "vertical" as const,
      minHeight: "60px",
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
    checkbox: {
      width: "16px",
      height: "16px",
      accentColor: "#111111",
      cursor: "pointer",
    },
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
          <h1 className="page-title animate-in">
            <span className="page-title-gradient">GMT Solutions</span> Lead Finder
          </h1>
          <p className="page-subtitle animate-in delay-1">
            Local cleaning business search for B2B cold calling. Scrape Google Maps and manage your outreach pipeline.
          </p>

          {/* Stats */}
          <div className="stats-grid animate-in delay-2">
            <div className="stat-card">
              <div className="stat-card-label">Database Leads</div>
              <div className="stat-card-value">{stats.total}</div>
              <div className="stat-card-detail">Total Maps leads</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Pending Calls</div>
              <div className="stat-card-value orange">{stats.pending}</div>
              <div className="stat-card-detail">Awaiting first call</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Total Attempted</div>
              <div className="stat-card-value">{stats.called}</div>
              <div className="stat-card-detail">Businesses called</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Meetings Booked</div>
              <div className="stat-card-value green">{stats.meetings}</div>
              <div className="stat-card-detail">Sales opportunities</div>
            </div>
          </div>

          {/* Leads Table */}
          <div
            className="animate-in delay-4"
            style={{
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            {/* Table Header Bar */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e5e5e5",
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "16px",
                    fontWeight: 600,
                  }}
                >
                  Cold Call Queue
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#999999",
                    marginTop: "2px",
                  }}
                >
                  {filteredLeads.length} leads
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  id="crm-search-filter"
                  style={{
                    ...s.input,
                    width: "200px",
                    height: "34px",
                    padding: "6px 12px",
                  }}
                  type="text"
                  placeholder="Search leads..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <select
                  id="crm-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    ...s.select,
                    width: "160px",
                    height: "34px",
                    padding: "6px 10px",
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Busy / No Answer">Busy / No Answer</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Meeting Scheduled">Meeting Scheduled</option>
                  <option value="Email Follow Up">Email Follow Up</option>
                  <option value="Text Follow Up">Text Follow Up</option>
                  <option value="Closed / Won">Closed / Won</option>
                </select>
                 <button
                  id="crm-export-csv-btn"
                  onClick={handleExportCSV}
                  style={{
                    padding: "6px 14px",
                    height: "34px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    background: "#ffffff",
                    color: "#111111",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#111111";
                    e.currentTarget.style.color = "#ffffff";
                    e.currentTarget.style.borderColor = "#111111";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.color = "#111111";
                    e.currentTarget.style.borderColor = "#e5e5e5";
                  }}
                >
                  Export CSV
                </button>
                <button
                  onClick={() => setShowManualModal(true)}
                  style={{
                    padding: "6px 14px",
                    height: "34px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    background: "#ffffff",
                    color: "#111111",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#111111";
                    e.currentTarget.style.color = "#ffffff";
                    e.currentTarget.style.borderColor = "#111111";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.color = "#111111";
                    e.currentTarget.style.borderColor = "#e5e5e5";
                  }}
                >
                  Add Lead
                </button>
              </div>
            </div>

            {/* Table Body */}
            {loadingLeads ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
                <div style={{ color: "#999999", fontSize: 14 }}>
                  Loading leads...
                </div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 24px",
                  color: "#999999",
                }}
              >
                No leads found. Run a scrape above to generate cold calling targets.
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}></th>
                      <th>Business</th>
                      <th style={{ width: "150px" }}>Phone</th>
                      <th style={{ width: "140px" }}>Status</th>
                      <th style={{ width: "100px" }}>Called</th>
                      <th style={{ width: "100px" }}>Caller</th>
                      <th style={{ width: "80px", textAlign: "center" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => {
                      const phone = parsePhone(lead.socials);
                      const category = parseCategory(lead.description);
                      const address = parseAddress(lead.description);
                      const rating = parseRating(lead.description);
                      const website = parseWebsite(lead.socials);
                      const crm = crmState[lead.id] || emptyCRM;
                      const isExpanded = expandedId === lead.id;
                      const isSaving = savingId === lead.id;
                      const currentStatus = statusState[lead.id] || "Pending";

                      const statusColor =
                        currentStatus === "Meeting Scheduled"
                          ? "#22863a"
                          : currentStatus === "Closed / Won"
                          ? "#111111"
                          : currentStatus === "Email Follow Up"
                          ? "#a78bfa"
                          : currentStatus === "Text Follow Up"
                          ? "#f97316"
                          : currentStatus === "Not Interested"
                          ? "#d1242f"
                          : currentStatus === "Busy / No Answer"
                          ? "#bf5600"
                          : "#888888";

                      return (
                        <>
                          <tr
                            key={lead.id}
                            style={{
                              cursor: "pointer",
                              background: isExpanded ? "#fafafa" : undefined,
                            }}
                            onClick={() =>
                              setExpandedId(isExpanded ? null : lead.id)
                            }
                          >
                            {/* Expand chevron */}
                            <td
                              style={{
                                textAlign: "center",
                                fontSize: "12px",
                                color: "#999999",
                                padding: "12px 8px 12px 16px",
                              }}
                            >
                              {isExpanded ? "\u25BC" : "\u25B6"}
                            </td>

                            {/* Business Name */}
                            <td>
                              <div>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: "#111111",
                                    fontSize: "14px",
                                  }}
                                >
                                  {lead.name}
                                </span>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "6px",
                                    marginTop: "3px",
                                    alignItems: "center",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "#666666",
                                      background: "#f5f5f5",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                    }}
                                  >
                                    {category}
                                  </span>
                                  {rating && (
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        color: "#bf5600",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {rating}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Phone */}
                            <td>
                              <a
                                href={`tel:${phone.replace(/\s+/g, "")}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  color: "#111111",
                                  fontWeight: 700,
                                  textDecoration: "none",
                                  fontSize: "14px",
                                }}
                              >
                                {phone}
                              </a>
                            </td>

                            {/* Status */}
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 10px",
                                  borderRadius: "20px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  color: statusColor,
                                  background:
                                    currentStatus === "Pending"
                                      ? "#f5f5f5"
                                      : `${statusColor}10`,
                                  border: `1px solid ${statusColor}22`,
                                }}
                              >
                                {currentStatus}
                              </span>
                            </td>

                            {/* Called */}
                            <td
                              style={{ textAlign: "center" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                style={s.checkbox}
                                checked={crm.called}
                                onChange={(e) =>
                                  updateCRMField(
                                    lead.id,
                                    "called",
                                    e.target.checked
                                  )
                                }
                              />
                            </td>

                            {/* Caller */}
                            <td onClick={(e) => e.stopPropagation()}>
                              <select
                                style={{
                                  ...s.select,
                                  padding: "4px 8px",
                                  fontSize: "12px",
                                }}
                                value={crm.caller}
                                onChange={(e) =>
                                  updateCRMField(
                                    lead.id,
                                    "caller",
                                    e.target.value
                                  )
                                }
                              >
                                <option value="">--</option>
                                <option value="Atirola">Atirola</option>
                                <option value="Latif">Latif</option>
                                <option value="Ola">Ola</option>
                              </select>
                            </td>

                            {/* Actions */}
                            <td
                              style={{ textAlign: "center" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                disabled={isSaving}
                                onClick={() => handleSaveLead(lead.id)}
                                style={{
                                  padding: "4px 12px",
                                  border: "1px solid #e5e5e5",
                                  borderRadius: "4px",
                                  background: isSaving ? "#f5f5f5" : "#111111",
                                  color: isSaving ? "#999" : "#ffffff",
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  cursor: isSaving
                                    ? "not-allowed"
                                    : "pointer",
                                  fontFamily: "'Inter', sans-serif",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {isSaving ? "..." : "Save"}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Details Row */}
                          {isExpanded && (
                            <tr key={`${lead.id}-detail`}>
                              <td
                                colSpan={7}
                                style={{
                                  background: "#fafafa",
                                  padding: "0",
                                  borderBottom: "2px solid #e5e5e5",
                                }}
                              >
                                <div
                                  style={{
                                    padding: "20px 24px 24px 48px",
                                    animation: "fadeInUp 0.2s ease",
                                  }}
                                >
                                  {/* Top: Business Details */}
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "24px",
                                      marginBottom: "20px",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <div style={{ flex: 1, minWidth: "200px" }}>
                                      <div style={s.label}>Address</div>
                                      <div
                                        style={{
                                          fontSize: "13px",
                                          color: "#555555",
                                        }}
                                      >
                                        {address || "N/A"}
                                      </div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: "200px" }}>
                                      <div style={{ ...s.label, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span>Director / Owner</span>
                                        <a
                                          href={crm.companyUrl || `https://www.google.com/search?q=${encodeURIComponent(lead.name + " companies house")}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            fontSize: "11px",
                                            color: "#3b82f6",
                                            textDecoration: "none",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "2px",
                                            fontWeight: 500,
                                            textTransform: "none",
                                          }}
                                          title="Search on Companies House"
                                        >
                                          🔍 Companies House
                                        </a>
                                      </div>
                                      <div
                                        style={{
                                          fontSize: "13px",
                                          color: "#111111",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {crm.directors && crm.directors.length > 0
                                          ? crm.directors.join(", ")
                                          : "Not Found"}
                                      </div>
                                    </div>
                                    <div style={{ minWidth: "160px" }}>
                                      <div style={s.label}>Rating</div>
                                      <div
                                        style={{
                                          fontSize: "13px",
                                          color: "#555555",
                                        }}
                                      >
                                        {rating || "N/A"}
                                      </div>
                                    </div>
                                    <div style={{ minWidth: "120px" }}>
                                      <div style={s.label}>Reviews</div>
                                      <div
                                        style={{
                                          fontSize: "13px",
                                          color: "#555555",
                                        }}
                                      >
                                        {lead.audience_size || "N/A"}
                                      </div>
                                    </div>
                                    <div style={{ minWidth: "160px" }}>
                                      <div style={s.label}>Links</div>
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: "10px",
                                        }}
                                      >
                                        <a
                                          href={lead.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            fontSize: "12px",
                                            color: "#111111",
                                            fontWeight: 500,
                                            textDecoration: "underline",
                                          }}
                                        >
                                          Google Maps
                                        </a>
                                        {website && (
                                          <a
                                            href={website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              fontSize: "12px",
                                              color: "#111111",
                                              fontWeight: 500,
                                              textDecoration: "underline",
                                            }}
                                          >
                                            Website
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Divider */}
                                  <div
                                    style={{
                                      borderTop: "1px solid #e5e5e5",
                                      margin: "0 0 20px 0",
                                    }}
                                  />

                                  {/* CRM Fields */}
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns:
                                        "1fr 1fr 1fr",
                                      gap: "16px",
                                      marginBottom: "16px",
                                    }}
                                  >
                                    <div>
                                      <div style={s.label}>Call Status</div>
                                      <select
                                        style={s.select}
                                        value={
                                          statusState[lead.id] || "Pending"
                                        }
                                        onChange={(e) => {
                                          setStatusState({
                                            ...statusState,
                                            [lead.id]: e.target.value,
                                          });
                                          const crm = crmState[lead.id] || { ...emptyCRM };
                                          if (!crm.dateOutreached) {
                                            updateCRMField(lead.id, "dateOutreached", new Date().toISOString().split("T")[0]);
                                          }
                                        }}
                                      >
                                        <option value="Pending" disabled hidden>Pending</option>
                                        <option value="Call Later">
                                          Call Later
                                        </option>
                                        <option value="Busy / No Answer">
                                          Busy / No Answer
                                        </option>
                                        <option value="Not Interested">
                                          Not Interested
                                        </option>
                                        <option value="Email Follow Up">
                                          Email Follow Up
                                        </option>
                                        <option value="Text Follow Up">
                                          Text Follow Up
                                        </option>
                                      </select>
                                    </div>
                                    <div>
                                      <div style={s.label}>
                                        Date Outreached
                                      </div>
                                      <input
                                        type="date"
                                        style={s.input}
                                        value={crm.dateOutreached || new Date().toISOString().split("T")[0]}
                                        onChange={(e) =>
                                          updateCRMField(
                                            lead.id,
                                            "dateOutreached",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>
                                    <div>
                                      <div style={s.label}>Called</div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "8px",
                                          paddingTop: "4px",
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          style={s.checkbox}
                                          checked={crm.called}
                                          onChange={(e) =>
                                            updateCRMField(
                                              lead.id,
                                              "called",
                                              e.target.checked
                                            )
                                          }
                                        />
                                        <span
                                          style={{
                                            fontSize: "13px",
                                            color: "#555555",
                                          }}
                                        >
                                          {crm.called ? "Yes" : "No"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Call Later Callback Date/Time Picker */}
                                  {(statusState[lead.id] === "Call Later") && (
                                    <div style={{ marginBottom: "16px", padding: "16px", background: "rgba(109, 40, 217, 0.05)", borderRadius: "8px", border: "1px solid rgba(109, 40, 217, 0.1)" }}>
                                      <div style={s.label}>Scheduled Callback Time</div>
                                      <input
                                        type="datetime-local"
                                        style={{
                                          width: "100%",
                                          maxWidth: "280px",
                                          padding: "8px 12px",
                                          border: "1px solid #e5e5e5",
                                          borderRadius: "6px",
                                          fontSize: "13px",
                                          fontFamily: "'Inter', sans-serif",
                                          background: "#fafafa",
                                          color: "#111111",
                                          outline: "none",
                                        }}
                                        value={crm.callbackTime || ""}
                                        onChange={(e) => updateCRMField(lead.id, "callbackTime", e.target.value)}
                                      />
                                      <div style={{ fontSize: "11px", color: "#666666", marginTop: "4px" }}>
                                        This lead will automatically appear in the <strong>Follow Ups</strong> checklist at the scheduled time.
                                      </div>
                                    </div>
                                  )}

                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr 1fr",
                                      gap: "16px",
                                    }}
                                  >
                                    <div>
                                      <div style={s.label}>Response</div>
                                      <input
                                        type="text"
                                        style={s.input}
                                        placeholder="What did they say?"
                                        value={crm.response}
                                        onChange={(e) =>
                                          updateCRMField(
                                            lead.id,
                                            "response",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>
                                    <div>
                                      <div style={s.label}>Notes</div>
                                      <textarea
                                        style={s.textarea}
                                        placeholder="Additional notes..."
                                        value={crm.notes}
                                        onChange={(e) =>
                                          updateCRMField(
                                            lead.id,
                                            "notes",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>
                                  </div>

                                  {/* Save button inside expanded */}
                                  <div
                                    style={{
                                      marginTop: "16px",
                                      display: "flex",
                                      justifyContent: "flex-end",
                                    }}
                                  >
                                    <button
                                      disabled={isSaving}
                                      onClick={() =>
                                        handleSaveLead(lead.id)
                                      }
                                      style={{
                                        padding: "8px 24px",
                                        border: "none",
                                        borderRadius: "6px",
                                        background: "#111111",
                                        color: "#ffffff",
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        cursor: isSaving
                                          ? "not-allowed"
                                          : "pointer",
                                        fontFamily: "'Inter', sans-serif",
                                        opacity: isSaving ? 0.5 : 1,
                                        transition: "all 0.15s ease",
                                      }}
                                    >
                                      {isSaving
                                        ? "Saving..."
                                        : "Save Changes"}
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Manual Lead Entry Modal */}
      {showManualModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: "12px",
            width: "500px",
            maxWidth: "90%",
            padding: "24px 30px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: "18px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e5e5", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#111111", margin: 0 }}>Add Manual Lead</h3>
              <button onClick={() => setShowManualModal(false)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#888", lineHeight: 1 }}>&times;</button>
            </div>

            <form onSubmit={handleAddManualLead} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={s.label}>Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sweet Treats Bakery"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  style={s.input}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={s.label}>Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +44 7123 456789"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    style={s.input}
                  />
                </div>
                <div>
                  <label style={s.label}>Business Owner / Director</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={manualDirector}
                    onChange={(e) => setManualDirector(e.target.value)}
                    style={s.input}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={s.label}>Website URL</label>
                  <input
                    type="text"
                    placeholder="e.g. www.sweettreats.com"
                    value={manualWebsite}
                    onChange={(e) => setManualWebsite(e.target.value)}
                    style={s.input}
                  />
                </div>
                <div>
                  <label style={s.label}>Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Bakery, Cake Shop"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    style={s.input}
                  />
                </div>
              </div>

              <div>
                <label style={s.label}>Address</label>
                <input
                  type="text"
                  placeholder="e.g. 123 Baker Street, London"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  style={s.input}
                />
              </div>

              <div>
                <label style={s.label}>Notes</label>
                <textarea
                  rows={3}
                  placeholder="Any details about how you found them, owner preferences, etc."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    background: "#ffffff",
                    color: "#333333",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingManual}
                  style={{
                    padding: "8px 20px",
                    border: "none",
                    borderRadius: "6px",
                    background: "linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(109, 40, 217, 0.15)"
                  }}
                >
                  {creatingManual ? "Adding..." : "Add Manual Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
