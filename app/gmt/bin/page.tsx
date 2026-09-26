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

export default function GMTBinPage() {
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

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    // Only display leads that are in database and pushed to list
    let result = leads.filter((l) => l.is_pushed === true);

    if (statusFilter !== "all") {
      result = result.filter((l) => l.price === statusFilter);
    } else {
      // DEFAULT FILTER FOR BIN: Show only Not Interested and Busy / No Answer
      result = result.filter((l) => l.price === "Not Interested" || l.price === "Busy / No Answer");
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
  }, [leads, statusFilter, searchFilter]);

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
      return {
        ...prev,
        [leadId]: {
          ...currentCRM,
          [field]: value,
        },
      };
    });
  };

  const handleSaveLead = async (leadId: string) => {
    setSavingId(leadId);
    try {
      const currentCRM = crmState[leadId] || emptyCRM;
      const status = statusState[leadId] || "Pending";

      const storedUser = localStorage.getItem("crm_user");
      if (storedUser) {
        currentCRM.caller = JSON.parse(storedUser).name;
      }

      const res = await fetch("/api/gmt/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          status,
          crmData: currentCRM,
        }),
      });

      if (!res.ok) throw new Error("HTTP error saving lead CRM details");

      const data = await res.json();
      if (data.success) {
        // Refresh leads list to propagate pipeline movements
        await fetchLeads();
      } else {
        alert("Failed to save CRM updates: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving CRM updates: " + err.message);
    } finally {
      setSavingId(null);
    }
  };

  // Parsers
  const parsePhone = (socials: string): string => {
    const match = socials.match(/Phone:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
    return match ? match[1] : "N/A";
  };

  const parseWebsite = (socials: string): string => {
    const match = socials.match(/Website:\s*([^\s|]+)/i);
    return match && match[1] !== "N/A" ? match[1] : "";
  };

  const parseCategory = (desc: string): string => {
    const match = desc.match(/Category:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
    return match ? match[1] : "N/A";
  };

  const parseAddress = (desc: string): string => {
    const match = desc.match(/Address:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
    return match ? match[1] : "N/A";
  };

  const parseRating = (desc: string): string => {
    const match = desc.match(/Rating:\s*([^\s|]+(?:\s+\([\d,]+\s+\w+\))?)/i);
    return match ? match[1] : "N/A";
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
    },
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
          <h1 className="page-title animate-in">
            <span className="page-title-gradient">Bin & No Response</span> Archive
          </h1>
          <p className="page-subtitle animate-in delay-1">
            Track leads that said no or had no response (Busy / No Answer). Move them out of the bin if they call back or get qualified.
          </p>

          {/* Leads Table */}
          <div
            className="animate-in delay-2"
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
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 600 }}>
                  Archived / Discarded Queue
                </div>
                <div style={{ fontSize: "12px", color: "#999999", marginTop: "2px" }}>
                  {filteredLeads.length} leads in the bin
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
                  placeholder="Search bin..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    width: "160px",
                    height: "34px",
                    padding: "6px 10px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontFamily: "'Inter', sans-serif",
                    background: "#fafafa",
                    color: "#111111",
                    cursor: "pointer"
                  }}
                >
                  <option value="all">All Discarded</option>
                  <option value="Busy / No Answer">Busy / No Answer</option>
                  <option value="Not Interested">Not Interested</option>
                </select>
              </div>
            </div>

            {/* Table Body */}
            {loadingLeads ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
                <div style={{ color: "#999999", fontSize: 14 }}>
                  Loading archived leads...
                </div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "#999999" }}>
                Bin is currently empty. Leads marked as Busy or Not Interested will appear here.
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
                      <th style={{ width: "80px", textAlign: "center" }}>Actions</th>
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

                      return (
                        <tr key={lead.id}>
                          <td>
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                              style={{
                                border: "none",
                                background: "none",
                                color: "#888888",
                                cursor: "pointer",
                                fontSize: "16px",
                                padding: "4px 8px",
                              }}
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: "#111111" }}>{lead.name}</div>
                            <div style={{ fontSize: "11px", color: "#888888", marginTop: "2px" }}>
                              {category} | Address: {address}
                            </div>
                          </td>
                          <td>{phone}</td>
                          <td>
                            <select
                              value={currentStatus}
                              onChange={(e) =>
                                setStatusState((prev) => ({ ...prev, [lead.id]: e.target.value }))
                              }
                              style={{
                                padding: "4px 8px",
                                border: "1px solid #e5e5e5",
                                borderRadius: "4px",
                                fontSize: "12px",
                                background: "#fafafa",
                                color: "#111111",
                                width: "100%"
                              }}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Busy / No Answer">Busy / No Answer</option>
                              <option value="Not Interested">Not Interested</option>
                              <option value="Meeting Scheduled">Meeting Scheduled</option>
                              <option value="Email Follow Up">Email Follow Up</option>
                              <option value="Text Follow Up">Text Follow Up</option>
                              <option value="Closed / Won">Closed / Won</option>
                              <option value="Call Later">Call Later</option>
                            </select>
                          </td>
                          <td>{crm.called ? "Yes" : "No"}</td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              onClick={() => handleSaveLead(lead.id)}
                              disabled={isSaving}
                              style={{
                                padding: "4px 10px",
                                border: "1px solid #111111",
                                borderRadius: "4px",
                                background: "#111111",
                                color: "#ffffff",
                                fontSize: "11px",
                                fontWeight: 500,
                                cursor: "pointer"
                              }}
                            >
                              {isSaving ? "Saving..." : "Save"}
                            </button>
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
