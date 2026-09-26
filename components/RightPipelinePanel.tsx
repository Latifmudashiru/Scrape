"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Lead {
  id: string;
  platform: string;
  name: string;
  link: string;
  description: string;
  price: string;
  emails: string;
  socials: string;
  igUsername: string | null;
  pipeline_status?: "booked_call" | "email_followup" | "text_followup" | "none";
}

export default function RightPipelinePanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setWorkspace(params.get("workspace"));
      setCurrentPath(window.location.pathname);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    
    const handleUpdate = () => fetchLeads();
    window.addEventListener("pipeline-updated", handleUpdate);
    return () => window.removeEventListener("pipeline-updated", handleUpdate);
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch("/api/outreach/leads");
      const data = await res.json();
      if (data.success) {
        setLeads(data.data || []);
      }
    } catch (e) {
      console.error("Failed to load leads for panel:", e);
    } finally {
      setLoading(false);
    }
  };

  const isGmt = currentPath.startsWith("/gmt") || workspace === "gmt";

  const booked = leads.filter((l) => l.pipeline_status === "booked_call");
  const emails = leads.filter((l) => l.pipeline_status === "email_followup");
  const texts = leads.filter((l) => l.pipeline_status === "text_followup");

  return (
    <div
      style={{
        width: "300px",
        flexShrink: 0,
        background: "var(--bg-secondary, #fafafa)",
        border: "1px solid var(--border-default, #e5e5e5)",
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        position: "sticky",
        top: "32px",
        maxHeight: "calc(100vh - 64px)",
        overflowY: "auto",
        boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
        marginTop: "8px"
      }}
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-primary, #111)" }}>Status Overview</h3>
          <Link href={isGmt ? "/pipeline?stage=booked&workspace=gmt" : "/pipeline?stage=booked"} style={{ fontSize: "11px", color: "var(--accent-purple, #111)", textDecoration: "none", fontWeight: 600 }}>
            View All &rarr;
          </Link>
        </div>
        <div style={{ height: "1px", background: "var(--border-default, #e5e5e5)" }} />
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
          <div className="loading-spinner" style={{ width: 20, height: 20 }} />
        </div>
      ) : (
        <>
          {/* Booked Calls Section */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h4 style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary, #555)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Booked Calls
              </h4>
              <span style={{ fontSize: "10px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "1px 6px", borderRadius: "10px", fontWeight: 600 }}>
                {booked.length}
              </span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {booked.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--text-muted, #999)", fontStyle: "italic", padding: "8px 4px" }}>
                  No booked calls
                </div>
              ) : (
                booked.map((lead) => (
                  <PanelCard key={lead.id} lead={lead} />
                ))
              )}
            </div>
          </div>

          {/* Emails Section */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h4 style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary, #555)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Emails
              </h4>
              <span style={{ fontSize: "10px", background: "rgba(167, 139, 250, 0.1)", color: "#a78bfa", padding: "1px 6px", borderRadius: "10px", fontWeight: 600 }}>
                {emails.length}
              </span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {emails.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--text-muted, #999)", fontStyle: "italic", padding: "8px 4px" }}>
                  No emails
                </div>
              ) : (
                emails.map((lead) => (
                  <PanelCard key={lead.id} lead={lead} />
                ))
              )}
            </div>
          </div>

          {/* Text Section */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h4 style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary, #555)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Text
              </h4>
              <span style={{ fontSize: "10px", background: "rgba(249, 115, 22, 0.1)", color: "#f97316", padding: "1px 6px", borderRadius: "10px", fontWeight: 600 }}>
                {texts.length}
              </span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {texts.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--text-muted, #999)", fontStyle: "italic", padding: "8px 4px" }}>
                  No text leads
                </div>
              ) : (
                texts.map((lead) => (
                  <PanelCard key={lead.id} lead={lead} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PanelCard({ lead }: { lead: Lead }) {
  const isGoogleMaps = lead.platform === "GoogleMaps" || lead.platform === "googlemaps";

  return (
    <div
      style={{
        background: "var(--bg-card, #ffffff)",
        border: "1px solid var(--border-default, #e5e5e5)",
        borderRadius: "8px",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
        <div style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-primary, #111)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", flex: 1 }}>
          {lead.name}
        </div>
        <span
          style={{
            fontSize: "9px",
            background:
              isGoogleMaps
                ? "rgba(16, 185, 129, 0.1)"
                : lead.platform === "YouTube"
                ? "rgba(239, 68, 68, 0.1)"
                : "rgba(236, 72, 153, 0.1)",
            color:
              isGoogleMaps
                ? "#10b981"
                : lead.platform === "YouTube"
                ? "#ef4444"
                : "#ec4899",
            padding: "1px 4px",
            borderRadius: "3px",
            flexShrink: 0
          }}
        >
          {isGoogleMaps ? "Maps" : lead.platform}
        </span>
      </div>
      <div style={{ fontSize: "10px", color: "var(--text-muted, #999)" }}>
        {lead.pipeline_status === "booked_call" && "Booked Calls"}
        {lead.pipeline_status === "email_followup" && "Emails"}
        {lead.pipeline_status === "text_followup" && "Text"}
      </div>
    </div>
  );
}
