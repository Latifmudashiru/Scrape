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
}

const emptyCRM: CRMData = {
  called: false,
  caller: "",
  response: "",
  dateOutreached: "",
  notes: "",
  directors: [],
  companyUrl: "",
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
    };
  } catch {
    return { ...emptyCRM, notes: emails };
  }
}

export default function GMTClientsPage() {
  const [leads, setLeads] = useState<GMTLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [crmState, setCrmState] = useState<Record<string, CRMData>>({});
  const [statusState, setStatusState] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const res = await fetch("/api/gmt/leads");
      const data = await res.json();
      if (data.success) {
        // Filter only Closed / Won leads
        const clientLeads = (data.data || []).filter(
          (l: GMTLead) => l.price === "Closed / Won"
        );
        setLeads(clientLeads);

        const initialCRM: Record<string, CRMData> = {};
        const initialStatus: Record<string, string> = {};
        clientLeads.forEach((l: GMTLead) => {
          initialCRM[l.id] = parseCRM(l.emails);
          initialStatus[l.id] = l.price;
        });
        setCrmState(initialCRM);
        setStatusState(initialStatus);
      }
    } catch (e: any) {
      console.error("Error loading clients:", e);
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

  const updateStatusField = (leadId: string, value: string) => {
    setStatusState((prev) => ({
      ...prev,
      [leadId]: value,
    }));
  };

  const handleSaveLead = async (leadId: string) => {
    setSavingId(leadId);
    try {
      const status = statusState[leadId] || "Closed / Won";
      const crm = crmState[leadId] || { ...emptyCRM };

      if (!crm.dateOutreached) {
        crm.dateOutreached = new Date().toISOString().split("T")[0];
      }

      const res = await fetch("/api/gmt/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status, crmData: crm }),
      });

      if (!res.ok) throw new Error("Failed to save changes");

      // If status changed to anything other than Closed / Won, remove it from list
      if (status !== "Closed / Won") {
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
      }
      alert("Client records updated successfully!");
    } catch (err: any) {
      alert("Error saving client details: " + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleExportCSV = () => {
    if (filteredClients.length === 0) return;
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
      "Date Closed",
      "Notes",
      "Maps URL",
    ];
    const rows = filteredClients.map((l) => {
      const crm = crmState[l.id] || emptyCRM;
      return [
        `"${l.name.replace(/"/g, '""')}"`,
        `"${parseCategory(l.description)}"`,
        `"${parsePhone(l.socials)}"`,
        `"${parseWebsite(l.socials)}"`,
        `"${parseAddress(l.description)}"`,
        `"${parseRating(l.description)}"`,
        `"${statusState[l.id] || "Closed / Won"}"`,
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
    link.setAttribute("download", "gmt_closed_clients.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const filteredClients = leads.filter((l) => {
    if (searchFilter.trim() === "") return true;
    const q = searchFilter.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.socials.toLowerCase().includes(q)
    );
  });

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
      accentColor: "#22863a",
      cursor: "pointer",
    },
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
          <h1 className="page-title animate-in">
            <span className="page-title-gradient" style={{ color: "#22863a" }}>GMT Solutions</span> Converted Clients
          </h1>
          <p className="page-subtitle animate-in delay-1">
            Review and manage cleaning companies successfully signed as active clients under the B2B loyalty card program.
          </p>

          {/* Stats Summary */}
          <div className="stats-grid animate-in delay-2">
            <div className="stat-card">
              <div className="stat-card-label">Active Clients</div>
              <div className="stat-card-value green">{leads.length}</div>
              <div className="stat-card-detail">Closed / Won cleaning businesses</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Conversion Rate</div>
              <div className="stat-card-value">
                {leads.length > 0 ? "100%" : "0%"}
              </div>
              <div className="stat-card-detail">Based on active database status</div>
            </div>
          </div>

          {/* Clients Table Container */}
          <div
            className="data-table-container animate-in delay-3"
            style={{
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            {/* Table Header Filter controls */}
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
                  Clients Directory
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#999999",
                    marginTop: "2px",
                  }}
                >
                  {filteredClients.length} clients registered
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  style={{
                    ...s.input,
                    width: "220px",
                    height: "34px",
                    padding: "6px 12px",
                  }}
                  type="text"
                  placeholder="Search clients..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <button
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
                    e.currentTarget.style.background = "#22863a";
                    e.currentTarget.style.color = "#ffffff";
                    e.currentTarget.style.borderColor = "#22863a";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.color = "#111111";
                    e.currentTarget.style.borderColor = "#e5e5e5";
                  }}
                >
                  Export CSV
                </button>
              </div>
            </div>

            {loadingLeads ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
                <div style={{ color: "#999999", fontSize: 14 }}>
                  Loading clients directory...
                </div>
              </div>
            ) : filteredClients.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 24px",
                  color: "#999999",
                }}
              >
                No active clients found. Move leads to 'Closed / Won' status to register them as clients.
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}></th>
                      <th>Business</th>
                      <th style={{ width: "150px" }}>Phone</th>
                      <th style={{ width: "140px" }}>Date Closed</th>
                      <th style={{ width: "120px" }}>Representative</th>
                      <th style={{ width: "80px", textAlign: "center" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((lead) => {
                      const phone = parsePhone(lead.socials);
                      const category = parseCategory(lead.description);
                      const address = parseAddress(lead.description);
                      const rating = parseRating(lead.description);
                      const website = parseWebsite(lead.socials);
                      const crm = crmState[lead.id] || emptyCRM;
                      const isExpanded = expandedId === lead.id;
                      const isSaving = savingId === lead.id;
                      const currentStatus = statusState[lead.id] || "Closed / Won";

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
                            {/* Chevron expand */}
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

                            {/* Client Name */}
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

                            {/* Date Outreached / Closed */}
                            <td>
                              <span style={{ fontSize: "13px", color: "#555555" }}>
                                {crm.dateOutreached || "N/A"}
                              </span>
                            </td>

                            {/* Representative */}
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

                            {/* Save action */}
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
                                  background: isSaving ? "#f5f5f5" : "#22863a",
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

                          {/* Expanded detail */}
                          {isExpanded && (
                            <tr key={`${lead.id}-detail`}>
                              <td
                                colSpan={6}
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
                                      <div style={{ fontSize: "13px", color: "#555555" }}>
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
                                      <div style={{ fontSize: "13px", color: "#111111", fontWeight: 600 }}>
                                        {crm.directors && crm.directors.length > 0
                                          ? crm.directors.join(", ")
                                          : "Not Found"}
                                      </div>
                                    </div>
                                    <div style={{ minWidth: "160px" }}>
                                      <div style={s.label}>Status State</div>
                                      <select
                                        style={{
                                          ...s.select,
                                          padding: "4px 8px",
                                          fontSize: "12px",
                                          height: "28px",
                                        }}
                                        value={currentStatus}
                                        onChange={(e) => {
                                          updateStatusField(lead.id, e.target.value);
                                          const crm = crmState[lead.id] || { ...emptyCRM };
                                          if (!crm.dateOutreached) {
                                            updateCRMField(lead.id, "dateOutreached", new Date().toISOString().split("T")[0]);
                                          }
                                        }}
                                      >
                                        <option value="Closed / Won">Closed / Won</option>
                                        <option value="Meeting Scheduled">Meeting Scheduled</option>
                                        <option value="Email Follow Up">Email Follow Up</option>
                                        <option value="Text Follow Up">Text Follow Up</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Busy / No Answer">Busy / No Answer</option>
                                        <option value="Not Interested">Not Interested</option>
                                      </select>
                                    </div>
                                    <div style={{ minWidth: "160px" }}>
                                      <div style={s.label}>Links</div>
                                      <div style={{ display: "flex", gap: "10px" }}>
                                        <a
                                          href={lead.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            fontSize: "12px",
                                            color: "#22863a",
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
                                              color: "#22863a",
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

                                  <div style={{ borderTop: "1px solid #e5e5e5", margin: "20px 0" }} />

                                  {/* Call response notes details */}
                                  <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                                    <div style={{ flex: 1, minWidth: "250px" }}>
                                      <div style={s.label}>Call Response</div>
                                      <input
                                        type="text"
                                        style={s.input}
                                        value={crm.response}
                                        onChange={(e) =>
                                          updateCRMField(
                                            lead.id,
                                            "response",
                                            e.target.value
                                          )
                                        }
                                        placeholder="e.g. Interested, send proposal next Tuesday"
                                      />
                                    </div>
                                    <div style={{ minWidth: "180px" }}>
                                      <div style={s.label}>Date Closed</div>
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
                                  </div>

                                  <div style={{ marginTop: "16px" }}>
                                    <div style={s.label}>Client Collaboration Notes</div>
                                    <textarea
                                      style={s.textarea}
                                      value={crm.notes}
                                      onChange={(e) =>
                                        updateCRMField(lead.id, "notes", e.target.value)
                                      }
                                      placeholder="Record details about the loyalty card launch, reward targets, QR code setup, etc..."
                                    />
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
    </div>
  );
}
