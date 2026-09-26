"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";

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
  pipeline_status?: "booked_call" | "email_followup" | "text_followup" | "none";
  email_template_id?: string | null;
  email_status?: "draft" | "scheduled" | "sent" | null;
  email_scheduled_at?: string | null;
  email_sent_at?: string | null;
  booked_reminder_template_id?: string | null;
  booked_reminder_status?: "none" | "scheduled" | "sent" | null;
  booked_reminder_scheduled_at?: string | null;
  booked_call_time?: string | null;
}

function PipelineContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dbTemplates, setDbTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [emailModalLead, setEmailModalLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const stageParam = searchParams?.get("stage") || "booked";

  let activeTab: "booked_call" | "email_followup" | "text_followup" = "booked_call";
  if (stageParam === "emails") activeTab = "email_followup";
  if (stageParam === "text") activeTab = "text_followup";

  useEffect(() => {
    fetchLeads();
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/outreach/templates");
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setDbTemplates(data.data);
      } else {
        setDbTemplates(EMAIL_TEMPLATES);
      }
    } catch {
      setDbTemplates(EMAIL_TEMPLATES);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const updateStage = async (leadId: string, newStatus: "booked_call" | "email_followup" | "text_followup" | "none" | "Closed / Won") => {
    setTransitioningId(leadId);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        const dbStatus = newStatus === "Closed / Won" ? "none" : newStatus;
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, pipeline_status: dbStatus as any } : l))
        );
      } else {
        alert("Failed to update stage: " + data.error);
      }
    } catch (e: any) {
      alert("Error updating stage: " + e.message);
    } finally {
      setTransitioningId(null);
    }
  };

  const updateEmailDetails = async (leadId: string, emailDetails: any) => {
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, emailDetails }),
      });
      const data = await res.json();
      if (data.success) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, ...emailDetails } : l))
        );
      } else {
        alert("Failed to update email properties: " + data.error);
      }
    } catch (e: any) {
      alert("Error updating email properties: " + e.message);
    }
  };

  // Filter leads into columns
  const bookedCallLeads = leads.filter((l) => l.pipeline_status === "booked_call");
  const emailFollowupLeads = leads.filter((l) => l.pipeline_status === "email_followup");
  const textFollowupLeads = leads.filter((l) => l.pipeline_status === "text_followup");

  const stats = {
    total: bookedCallLeads.length + emailFollowupLeads.length + textFollowupLeads.length,
    booked: bookedCallLeads.length,
    email: emailFollowupLeads.length,
    text: textFollowupLeads.length,
  };

  // Helper to extract phone number
  const parsePhone = (socialsStr: string): string => {
    if (!socialsStr) return "N/A";
    const parts = socialsStr.split("|").map((s) => s.trim());
    const phonePart = parts.find((p) => /^\+?[0-9\s-()]+$/.test(p) || p.startsWith("Phone:") || p.includes("tel:"));
    if (phonePart) return phonePart.replace("Phone:", "").trim();
    
    // Fallback search for numbers
    for (const part of parts) {
      const cleaned = part.replace(/[^0-9+]/g, "");
      if (cleaned.length >= 8 && cleaned.length <= 15) {
        return part;
      }
    }
    return "N/A";
  };

  const pageTitle = "Outreach Pipeline";
  const pageDescription = "Manage prospects across email campaigns, manual texts, and scheduled calls.";

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content" style={{ maxWidth: "100%" }}>
          <h1 className="page-title animate-in">
            <span className="page-title-gradient">{pageTitle}</span>
          </h1>
          <p className="page-subtitle animate-in delay-1">
            {pageDescription}
          </p>

          {/* Stats Summary Grid */}
          <div className="stats-grid animate-in delay-2" style={{ marginBottom: "2rem" }}>
            <div className="stat-card">
              <div className="stat-card-label">Total Leads</div>
              <div className="stat-card-value">{stats.total}</div>
              <div className="stat-card-detail">Active progressed leads</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Booked Calls</div>
              <div className="stat-card-value green">{stats.booked}</div>
              <div className="stat-card-detail">Automation emails queued</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Emails</div>
              <div className="stat-card-value" style={{ color: "var(--accent-purple, #a78bfa)" }}>{stats.email}</div>
              <div className="stat-card-detail">Timeline sequence started</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Text</div>
              <div className="stat-card-value orange">{stats.text}</div>
              <div className="stat-card-detail">Requires manual SMS text</div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
              <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading leads data...</div>
            </div>
          ) : (
            <div className="animate-in delay-3" style={{ display: "flex", gap: "24px", alignItems: "start" }}>

              {/* Columns container */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  gap: "20px",
                  alignItems: "stretch",
                  overflowX: "auto",
                  paddingBottom: "12px",
                }}
              >
                {/* Column 1: Emails */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverColumn !== "email_followup") setDragOverColumn("email_followup");
                  }}
                  onDragLeave={() => setDragOverColumn(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverColumn(null);
                    const leadId = e.dataTransfer.getData("text/plain");
                    if (leadId) updateStage(leadId, "email_followup");
                  }}
                  style={{
                    flex: 1,
                    minWidth: "320px",
                    background: dragOverColumn === "email_followup" ? "rgba(167, 139, 250, 0.04)" : "var(--bg-secondary, #fafafa)",
                    border: dragOverColumn === "email_followup" ? "2px dashed #a78bfa" : "1px solid var(--border-default, #e5e5e5)",
                    borderRadius: "12px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    maxHeight: "calc(100vh - 300px)",
                    overflowY: "auto",
                    transition: "background-color 0.2s, border-color 0.2s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-default, #e5e5e5)", paddingBottom: "10px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: "700", fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-primary)" }}>Email Follow Ups</h3>
                    <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "10px", background: "rgba(167, 139, 250, 0.1)", color: "#a78bfa" }}>
                      {emailFollowupLeads.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {emailFollowupLeads.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "32px 10px", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>
                        No email follow-ups.
                      </div>
                    ) : (
                      emailFollowupLeads.map((lead) => (
                        <LeadCard key={lead.id} lead={lead} updateStage={updateStage} updateEmailDetails={updateEmailDetails} parsePhone={parsePhone} disabled={transitioningId === lead.id} isSelected={selectedLeadId === lead.id} onSelect={() => setSelectedLeadId(lead.id)} onSendEmailClick={(l) => setEmailModalLead(l)} templates={dbTemplates} />
                      ))
                    )}
                  </div>
                </div>

                {/* Column 2: Text */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverColumn !== "text_followup") setDragOverColumn("text_followup");
                  }}
                  onDragLeave={() => setDragOverColumn(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverColumn(null);
                    const leadId = e.dataTransfer.getData("text/plain");
                    if (leadId) updateStage(leadId, "text_followup");
                  }}
                  style={{
                    flex: 1,
                    minWidth: "320px",
                    background: dragOverColumn === "text_followup" ? "rgba(249, 115, 22, 0.04)" : "var(--bg-secondary, #fafafa)",
                    border: dragOverColumn === "text_followup" ? "2px dashed #f97316" : "1px solid var(--border-default, #e5e5e5)",
                    borderRadius: "12px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    maxHeight: "calc(100vh - 300px)",
                    overflowY: "auto",
                    transition: "background-color 0.2s, border-color 0.2s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-default, #e5e5e5)", paddingBottom: "10px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: "700", fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-primary)" }}>Text Follow Ups</h3>
                    <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "10px", background: "rgba(249, 115, 22, 0.1)", color: "#f97316" }}>
                      {textFollowupLeads.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {textFollowupLeads.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "32px 10px", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>
                        No text follow-ups.
                      </div>
                    ) : (
                      textFollowupLeads.map((lead) => (
                        <LeadCard key={lead.id} lead={lead} updateStage={updateStage} updateEmailDetails={updateEmailDetails} parsePhone={parsePhone} disabled={transitioningId === lead.id} isSelected={selectedLeadId === lead.id} onSelect={() => setSelectedLeadId(lead.id)} onSendEmailClick={(l) => setEmailModalLead(l)} templates={dbTemplates} />
                      ))
                    )}
                  </div>
                </div>

                {/* Column 3: Booked Calls */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverColumn !== "booked_call") setDragOverColumn("booked_call");
                  }}
                  onDragLeave={() => setDragOverColumn(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverColumn(null);
                    const leadId = e.dataTransfer.getData("text/plain");
                    if (leadId) updateStage(leadId, "booked_call");
                  }}
                  style={{
                    flex: 1,
                    minWidth: "320px",
                    background: dragOverColumn === "booked_call" ? "rgba(16, 185, 129, 0.04)" : "var(--bg-secondary, #fafafa)",
                    border: dragOverColumn === "booked_call" ? "2px dashed #10b981" : "1px solid var(--border-default, #e5e5e5)",
                    borderRadius: "12px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    maxHeight: "calc(100vh - 300px)",
                    overflowY: "auto",
                    transition: "background-color 0.2s, border-color 0.2s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-default, #e5e5e5)", paddingBottom: "10px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: "700", fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-primary)" }}>Booked Calls</h3>
                    <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
                      {bookedCallLeads.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {bookedCallLeads.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "32px 10px", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>
                        No booked calls.
                      </div>
                    ) : (
                      bookedCallLeads.map((lead) => (
                        <LeadCard key={lead.id} lead={lead} updateStage={updateStage} updateEmailDetails={updateEmailDetails} parsePhone={parsePhone} disabled={transitioningId === lead.id} isSelected={selectedLeadId === lead.id} onSelect={() => setSelectedLeadId(lead.id)} onSendEmailClick={(l) => setEmailModalLead(l)} templates={dbTemplates} />
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Email Composer Modal */}
              {emailModalLead && (
                <EmailComposerModal
                  lead={emailModalLead}
                  onClose={() => setEmailModalLead(null)}
                  updateEmailDetails={updateEmailDetails}
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

interface LeadCardProps {
  lead: Lead;
  updateStage: (leadId: string, status: "booked_call" | "email_followup" | "text_followup" | "none" | "Closed / Won") => Promise<void>;
  updateEmailDetails: (leadId: string, emailDetails: any) => Promise<void>;
  parsePhone: (socials: string) => string;
  disabled: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onSendEmailClick?: (lead: Lead, templateId: string) => void;
  templates: any[];
}

const EMAIL_TEMPLATES = [
  {
    id: "gmt_loyalty",
    name: "Digital Loyalty Card (B2B)",
    subject: "Digital Loyalty Card System for {BusinessName}",
    body: `Hi {OwnerName},

My name is Ati and I specialise in helping cleaning companies across East London move away from paper stamp cards to a modern digital loyalty system.

The way it works is simple. Customers scan a QR code at your counter with their phone to collect stamps, and once they hit their target they can redeem a reward. It works on any phone, and the whole thing is fully branded to your shop. It takes away the hassle of printing cards, customers losing them, and staff having to manage them manually.

On top of that, you get access to real customer data so you can see how often people are coming back, which rewards are being redeemed, and how your loyalty scheme is actually performing. That kind of insight is something paper cards simply cannot give you.

I looked at your website {Website} and I genuinely think this would be a great fit for you. The shop already has a strong identity and a loyal customer base, and a digital loyalty system would give you a proper way to reward that and keep people coming back more consistently.

You can see a live example of how the system looks and works here: 
https://gmtsolutions.netlify.app/?project=colombican

I would love to get on a quick call rather than go back and forth over email. Even just 15 to 20 minutes on Google Meet would be enough for me to walk you through everything and answer any questions you have. If that sounds good, just reply and we can get something booked in.

Booking Link:
https://calendly.com/atirolaa/30min

Looking forward to hearing from you.

Best regards,
Ati`
  },
  {
    id: "creator_growth",
    name: "Creator Sponsorship/Growth",
    subject: "Partnership Opportunity with {BusinessName}",
    body: `Hi {OwnerName},

My name is Ati and I've been following your content. I really love what you're doing.

I wanted to reach out because we are working with creators in your space to build custom digital experiences and sponsorships. 

I would love to connect and share some ideas on how we can work together to monetize your audience and launch a custom branded experience. 

If you're open to a 10-minute chat, you can book a time directly on my Calendly:
https://calendly.com/atirolaa/30min

Best regards,
Ati`
  }
];

const REMINDER_TEMPLATES = [
  {
    id: "reminder_24h",
    name: "24h Call Reminder",
    subject: "Reminder: Call with Ati (GMT Solutions) tomorrow",
    body: `Hi {OwnerName},

This is a quick reminder that we have a call scheduled for tomorrow to discuss the digital loyalty system for {BusinessName}.

Meeting details:
- When: tomorrow
- Link: https://calendly.com/atirolaa/30min (Google Meet link is in the calendar invite)

Looking forward to speaking with you!

Best regards,
Ati`
  },
  {
    id: "reminder_1h",
    name: "1h Call Quick Reminder",
    subject: "Starting in 1 hour: Ati & {BusinessName} Chat",
    body: `Hi {OwnerName},

Just a quick heads-up that we are starting our Google Meet call in about 1 hour. 

Here is the meeting link for your convenience: https://meet.google.com/xyz-pdq-abc

Talk soon!

Best regards,
Ati`
  }
];

function compileTemplate(templateBody: string, templateSubject: string, lead: any, senderName?: string) {
  const isGoogleMaps = lead.platform === "GoogleMaps" || lead.platform === "googlemaps";
  
  // Extract director name(s)
  let directorName = "Owner";
  try {
    const parsedCRM = JSON.parse(lead.emails || "{}");
    if (parsedCRM.directors && parsedCRM.directors.length > 0) {
      directorName = parsedCRM.directors[0];
    } else if (parsedCRM.directors_name) {
      directorName = parsedCRM.directors_name;
    } else if (lead.description && lead.description.includes("Director:")) {
      const match = lead.description.match(/Director:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
      if (match && match[1] !== "Not Found") {
        directorName = match[1];
      }
    }
  } catch (e) {
    // ignore
  }

  // Fallback if director name is still Owner
  if (directorName === "Owner" || !directorName) {
    directorName = lead.name ? `${lead.name} Owner` : "Owner";
  }

  // Parse phone and website
  const parsePhone = (socials: string): string => {
    if (!socials) return "";
    const match = socials.match(/Phone:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
    return match ? match[1] : "";
  };
  const phone = parsePhone(lead.socials) || "N/A";

  const parseWebsite = (socials: string): string => {
    if (!socials) return "";
    const match = socials.match(/Website:\s*([^\s|]+)/i);
    return match && match[1] !== "N/A" ? match[1] : "";
  };
  const website = parseWebsite(lead.socials) || "your website";

  // Determine sender
  let finalSender = senderName || "Ati";
  if (!senderName) {
    try {
      const parsedCRM = JSON.parse(lead.emails || "{}");
      if (parsedCRM.caller) {
        finalSender = parsedCRM.caller;
      }
    } catch {}
  }

  const replacements: Record<string, string> = {
    // Old placeholders
    "{BusinessName}": lead.name || "your business",
    "{OwnerName}": directorName,
    "{Website}": website,
    // New placeholders
    "{business_name}": lead.name || "your business",
    "{director_name}": directorName,
    "{phone_number}": phone,
    "{sender_name}": finalSender
  };

  let compiledBody = templateBody;
  let compiledSubject = templateSubject;

  Object.entries(replacements).forEach(([key, val]) => {
    compiledBody = compiledBody.replaceAll(key, val);
    compiledSubject = compiledSubject.replaceAll(key, val);
  });

  return { subject: compiledSubject, body: compiledBody };
}

function LeadCard({ lead, updateStage, updateEmailDetails, parsePhone, disabled, isSelected, onSelect, onSendEmailClick, templates }: LeadCardProps) {
  const isGoogleMaps = lead.platform === "GoogleMaps" || lead.platform === "googlemaps";
  const phone = parsePhone(lead.socials);
  
  // Extract website for GoogleMaps
  const parseWebsite = (socials: string): string => {
    if (!socials) return "";
    const match = socials.match(/Website:\s*([^\s|]+)/i);
    return match && match[1] !== "N/A" ? match[1] : "";
  };
  const website = isGoogleMaps ? parseWebsite(lead.socials) : "";

  // Extract category for GoogleMaps
  const parseCategory = (desc: string): string => {
    if (!desc) return "";
    const match = desc.match(/Category:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
    return match ? match[1] : "";
  };
  const category = isGoogleMaps ? parseCategory(lead.description) : "";

  const showAutomationIcon = lead.pipeline_status === "booked_call" || lead.pipeline_status === "email_followup";

  // Template selections
  const [selectedTemplateId, setSelectedTemplateId] = useState(lead.email_template_id || (templates[0] && templates[0].id) || "");
  const [selectedReminderId, setSelectedReminderId] = useState(lead.booked_reminder_template_id || REMINDER_TEMPLATES[0].id);
  const [showScheduler, setShowScheduler] = useState(false);

  // Handlers
  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    await updateEmailDetails(lead.id, { email_template_id: templateId });
  };

  const handleReminderChange = async (reminderId: string) => {
    setSelectedReminderId(reminderId);
    await updateEmailDetails(lead.id, { booked_reminder_template_id: reminderId });
  };

  const handleSetCallTime = async (time: string) => {
    await updateEmailDetails(lead.id, {
      booked_call_time: time,
      booked_reminder_status: "scheduled"
    });
  };

  const handleSendEmail = () => {
    if (onSendEmailClick) {
      onSendEmailClick(lead, selectedTemplateId);
    }
  };

  const handleScheduleEmail = async (timeframe: "1h" | "tomorrow" | "2d") => {
    let date = new Date();
    if (timeframe === "1h") {
      date = new Date(Date.now() + 60 * 60 * 1000);
    } else if (timeframe === "tomorrow") {
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
    } else if (timeframe === "2d") {
      date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    }

    await updateEmailDetails(lead.id, {
      email_template_id: selectedTemplateId,
      email_status: "scheduled",
      email_scheduled_at: date.toISOString(),
    });
    setShowScheduler(false);
  };

  const formatDate = (isoStr: string | null | undefined) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      onClick={onSelect}
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      style={{
        background: isSelected ? "rgba(17, 17, 17, 0.04)" : "var(--bg-card, #ffffff)",
        border: isSelected ? "1px solid var(--text-accent, #111111)" : "1px solid var(--border-default, #e5e5e5)",
        borderRadius: 8,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        boxShadow: "var(--shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06))",
        transition: "transform 0.2s, border-color 0.2s, background-color 0.2s",
        position: "relative",
        cursor: "pointer"
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "var(--border-hover, #cccccc)";
        }
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "var(--border-default, #e5e5e5)";
        }
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary, #111111)" }}>{lead.name}</div>
        <span
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: 10,
            background:
              isGoogleMaps
                ? "rgba(16, 185, 129, 0.15)"
                : lead.platform === "YouTube"
                ? "rgba(239, 68, 68, 0.15)"
                : lead.platform === "Whop"
                ? "rgba(6, 182, 212, 0.15)"
                : lead.platform === "Skool"
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(236, 72, 153, 0.15)",
            color:
              isGoogleMaps
                ? "#10b981"
                : lead.platform === "YouTube"
                ? "#ef4444"
                : lead.platform === "Whop"
                ? "#06b6d4"
                : lead.platform === "Skool"
                ? "#10b981"
                : "#ec4899",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {isGoogleMaps ? "Google Maps" : lead.platform}
        </span>
      </div>

      {isGoogleMaps && category && (
        <div style={{ fontSize: 11, color: "#bf5600", background: "rgba(191, 86, 0, 0.08)", padding: "2px 6px", borderRadius: 4, alignSelf: "flex-start" }}>
          {category}
        </div>
      )}

      {lead.description && !isGoogleMaps && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary, #555555)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.4,
          }}
          title={lead.description}
        >
          {lead.description}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: 12 }} onClick={(e) => e.stopPropagation()}>
        {!isGoogleMaps && lead.emails && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted, #777777)" }}>Email:</span>
            <a href={`mailto:${lead.emails}`} style={{ color: "#059669", textDecoration: "none", fontWeight: "500" }}>
              {lead.emails}
            </a>
          </div>
        )}
        {phone && phone !== "N/A" && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted, #777777)" }}>Phone:</span>
            <span style={{ color: "var(--text-primary, #111111)" }}>{phone}</span>
          </div>
        )}
        {isGoogleMaps && website && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted, #777777)" }}>Website:</span>
            <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" style={{ color: "#059669", textDecoration: "none", fontWeight: "500" }}>
              Visit Website ↗
            </a>
          </div>
        )}
        {isGoogleMaps && lead.link && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted, #777777)" }}>Google Maps:</span>
            <a href={lead.link} target="_blank" rel="noopener noreferrer" style={{ color: "#6d28d9", textDecoration: "none", fontWeight: "500" }}>
              View Location ↗
            </a>
          </div>
        )}
        {!isGoogleMaps && lead.igUsername && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted, #777777)" }}>Instagram:</span>
            <a
              href={`https://instagram.com/${lead.igUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#6d28d9", textDecoration: "none", fontWeight: "500" }}
            >
              @{lead.igUsername} ↗
            </a>
          </div>
        )}
      </div>

      {/* --- COLLAPSABLE DETAILS: HIDE UNLESS SELECTED --- */}
      {isSelected && (
        <>
          {/* --- EMAILS SECTION ON CARD --- */}
          {lead.pipeline_status === "email_followup" && (
            <div style={{ borderTop: "1px dashed var(--border-default, #e5e5e5)", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#6d28d9" }}>Email Template:</span>
                <span 
                  style={{ 
                    fontSize: "10px", 
                    color: lead.email_status === "sent" ? "#10b981" : lead.email_status === "scheduled" ? "#f59e0b" : "#555555",
                    background: lead.email_status === "sent" ? "rgba(16,185,129,0.1)" : lead.email_status === "scheduled" ? "rgba(245,158,11,0.1)" : "rgba(120,120,120,0.1)",
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontWeight: 600
                  }}
                >
                  {lead.email_status === "sent" ? "Sent" : lead.email_status === "scheduled" ? "Scheduled" : "Draft"}
                </span>
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  style={{
                    flex: 1,
                    background: "#fafafa",
                    color: "var(--text-primary, #111111)",
                    border: "1px solid var(--border-default, #e5e5e5)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id} style={{ background: "#ffffff" }}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                <button
                  onClick={handleSendEmail}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "opacity 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  Send Email
                </button>
                <button
                  onClick={() => setShowScheduler(!showScheduler)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    background: "var(--bg-secondary, #fafafa)",
                    color: "var(--text-primary, #111111)",
                    border: "1px solid var(--border-default, #e5e5e5)",
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  Schedule
                </button>
              </div>

              {showScheduler && (
                <div style={{ display: "flex", gap: "6px", marginTop: "4px", alignItems: "center", background: "var(--bg-secondary, #fafafa)", border: "1px solid var(--border-default, #e5e5e5)", padding: "6px", borderRadius: 6 }}>
                  <span style={{ fontSize: "10px", color: "var(--text-secondary, #555555)", flexShrink: 0 }}>Send:</span>
                  <button 
                    onClick={() => handleScheduleEmail("1h")}
                    style={{ flex: 1, background: "#ffffff", border: "1px solid var(--border-default, #e5e5e5)", color: "var(--text-primary, #111111)", fontSize: "10px", padding: "3px 4px", borderRadius: 4, cursor: "pointer" }}
                  >
                    1h
                  </button>
                  <button 
                    onClick={() => handleScheduleEmail("tomorrow")}
                    style={{ flex: 1, background: "#ffffff", border: "1px solid var(--border-default, #e5e5e5)", color: "var(--text-primary, #111111)", fontSize: "10px", padding: "3px 4px", borderRadius: 4, cursor: "pointer" }}
                  >
                    Tmrw 9am
                  </button>
                  <button 
                    onClick={() => handleScheduleEmail("2d")}
                    style={{ flex: 1, background: "#ffffff", border: "1px solid var(--border-default, #e5e5e5)", color: "var(--text-primary, #111111)", fontSize: "10px", padding: "3px 4px", borderRadius: 4, cursor: "pointer" }}
                  >
                    2 Days
                  </button>
                </div>
              )}

              {lead.email_status === "sent" && lead.email_sent_at && (
                <div style={{ fontSize: "10px", color: "var(--text-muted, #777777)", fontStyle: "italic" }}>
                  Sent at: {formatDate(lead.email_sent_at)}
                </div>
              )}
              {lead.email_status === "scheduled" && lead.email_scheduled_at && (
                <div style={{ fontSize: "10px", color: "#f59e0b", fontStyle: "italic" }}>
                  Scheduled for: {formatDate(lead.email_scheduled_at)}
                </div>
              )}
            </div>
          )}

          {/* --- BOOKED CALLS REMINDERS ON CARD --- */}
          {lead.pipeline_status === "booked_call" && (
            <div style={{ borderTop: "1px dashed var(--border-default, #e5e5e5)", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#10b981" }}>Call Date & Time:</span>
                <input
                  type="datetime-local"
                  value={lead.booked_call_time || ""}
                  onChange={(e) => handleSetCallTime(e.target.value)}
                  style={{
                    background: "#fafafa",
                    color: "var(--text-primary, #111111)",
                    border: "1px solid var(--border-default, #e5e5e5)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontFamily: "inherit",
                    outline: "none",
                    cursor: "pointer",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#6d28d9" }}>Template:</span>
                <select
                  value={selectedReminderId}
                  onChange={(e) => handleReminderChange(e.target.value)}
                  style={{
                    flex: 1,
                    background: "#fafafa",
                    color: "var(--text-primary, #111111)",
                    border: "1px solid var(--border-default, #e5e5e5)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {REMINDER_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id} style={{ background: "#ffffff" }}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Automatic Reminders Checklist */}
              {lead.booked_call_time ? (() => {
                const callDate = new Date(lead.booked_call_time);
                
                // 9am of day of call
                const date9AM = new Date(callDate);
                date9AM.setHours(9, 0, 0, 0);
                
                // 1h before
                const date1H = new Date(callDate.getTime() - 60 * 60 * 1000);
                // 30m before
                const date30M = new Date(callDate.getTime() - 30 * 60 * 1000);

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "var(--bg-secondary, #fafafa)", border: "1px solid var(--border-default, #e5e5e5)", padding: "10px", borderRadius: 6, fontSize: "10px" }}>
                    <div style={{ fontWeight: "600", color: "#6d28d9", textTransform: "uppercase", letterSpacing: "0.5px" }}>Reminders (Auto):</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary, #555555)" }}>
                      <span>9:00 AM Call-Day:</span>
                      <span style={{ color: "#10b981", fontWeight: "600" }}>{formatDate(date9AM.toISOString())}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary, #555555)" }}>
                      <span>1h Before:</span>
                      <span style={{ color: "#10b981", fontWeight: "600" }}>{formatDate(date1H.toISOString())}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary, #555555)" }}>
                      <span>30m Before:</span>
                      <span style={{ color: "#10b981", fontWeight: "600" }}>{formatDate(date30M.toISOString())}</span>
                    </div>
                  </div>
                );
              })() : (
                <div style={{ fontSize: "10px", color: "#f59e0b", fontStyle: "italic", textAlign: "center", background: "rgba(245,158,11,0.06)", padding: "6px", borderRadius: 6 }}>
                  ⚠️ Set date & time to queue reminders
                </div>
              )}
            </div>
          )}

          {/* --- MOVEMENT CONTROL SELECT --- */}
          <div
            style={{
              borderTop: "1px solid var(--border-default, #e5e5e5)",
              paddingTop: "10px",
              marginTop: "4px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {showAutomationIcon && !isGoogleMaps && (
                <span
                  style={{ fontSize: 10, color: "#10b981", background: "rgba(16, 185, 129, 0.08)", padding: "2px 6px", borderRadius: 4, display: "flex", alignItems: "center", gap: 3 }}
                  title="Webhook triggers email reminder workflow"
                >
                  n8n Active
                </span>
              )}
            </div>
            
            <select
              value={lead.pipeline_status || "none"}
              disabled={disabled}
              onChange={(e) => updateStage(lead.id, e.target.value as any)}
              style={{
                background: "#fafafa",
                color: "var(--text-primary, #111111)",
                border: "1px solid var(--border-default, #e5e5e5)",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: "11px",
                fontFamily: "inherit",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="booked_call" style={{ background: "#ffffff" }}>Booked Calls</option>
              <option value="email_followup" style={{ background: "#ffffff" }}>Emails</option>
              <option value="text_followup" style={{ background: "#ffffff" }}>Text</option>
              <option value="Closed / Won" style={{ background: "#ffffff" }}>Client (Closed / Won)</option>
              <option value="none" style={{ background: "#ffffff" }}>Move Out (None)</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}

interface EmailComposerModalProps {
  lead: Lead;
  onClose: () => void;
  updateEmailDetails: (leadId: string, emailDetails: any) => Promise<void>;
}

function EmailComposerModal({ lead, onClose, updateEmailDetails }: EmailComposerModalProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [senderName, setSenderName] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("crm_user");
      if (stored) return JSON.parse(stored).name;
    }
    return "Atirola";
  });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Load templates
    const loadTemplates = async () => {
      try {
        const res = await fetch("/api/outreach/templates");
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          setTemplates(data.data);
          
          // Try to select default
          const defaultT = data.data[0];
          setSelectedTemplateId(defaultT.id);
          const compiled = compileTemplate(defaultT.body, defaultT.subject, lead, senderName);
          setSubject(compiled.subject);
          setBody(compiled.body);
        } else {
          // Fallback if no templates in db
          setTemplates(EMAIL_TEMPLATES);
          const defaultT = EMAIL_TEMPLATES[0];
          setSelectedTemplateId(defaultT.id);
          const compiled = compileTemplate(defaultT.body, defaultT.subject, lead, senderName);
          setSubject(compiled.subject);
          setBody(compiled.body);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, [lead]);

  // Recalculate on template or sender change
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const compiled = compileTemplate(template.body, template.subject, lead, senderName);
      setSubject(compiled.subject);
      setBody(compiled.body);
    }
  };

  const handleSenderChange = (sender: string) => {
    setSenderName(sender);
    const template = templates.find(t => t.id === selectedTemplateId);
    if (template) {
      const compiled = compileTemplate(template.body, template.subject, lead, sender);
      setSubject(compiled.subject);
      setBody(compiled.body);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      // 1. Mark as sent with custom subject/body
      await updateEmailDetails(lead.id, {
        email_template_id: selectedTemplateId,
        email_status: "sent",
        email_sent_at: new Date().toISOString(),
        custom_subject: subject,
        custom_body: body
      });

      // 2. Append custom email sent details to CRM notes
      try {
        const res = await fetch("/api/gmt/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: lead.id,
            status: lead.price, // Keep current call status
            crmData: {
              called: true,
              caller: senderName,
              response: "Email Sent",
              dateOutreached: new Date().toLocaleDateString(),
              notes: `[Email Sent] Subject: ${subject}\n\nBody:\n${body}`
            }
          })
        });
      } catch (err) {
        console.warn("Failed to append sent email details to CRM notes:", err);
      }

      alert("Email sent successfully!");
      onClose();
    } catch (e: any) {
      alert("Error sending email: " + e.message);
    } finally {
      setSending(false);
    }
  };

  const recipient = lead.emails || (lead.igUsername ? `@${lead.igUsername}` : "No email available");

  return (
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
      zIndex: 1000,
    }}>
      <div style={{
        background: "#ffffff",
        border: "1px solid var(--border-default, #e5e5e5)",
        borderRadius: "12px",
        width: "600px",
        maxWidth: "90%",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
        overflow: "hidden"
      }}>
        {/* Modal Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#111111", margin: 0 }}>Compose Outreach Email</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#888" }}>&times;</button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
          <div>
            {/* Template Select */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Template</label>
              {loading ? (
                <div style={{ padding: "8px 0", fontSize: "12px", color: "#999" }}>Loading templates...</div>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e5e5", borderRadius: "6px", fontSize: "13px", background: "#fafafa", color: "#333" }}
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>To</label>
            <input
              type="text"
              readOnly
              value={recipient}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e5e5", borderRadius: "6px", fontSize: "13px", background: "#eee", color: "#555" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e5e5", borderRadius: "6px", fontSize: "13px", color: "#333" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Message</label>
            <textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ width: "100%", padding: "10px", border: "1px solid #e5e5e5", borderRadius: "6px", fontSize: "13px", lineHeight: 1.5, fontFamily: "inherit", color: "#333" }}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "flex-end", gap: "10px", background: "#fafafa" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #e5e5e5", borderRadius: "6px", background: "#fff", cursor: "pointer", fontSize: "13px", color: "#333" }}>Cancel</button>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              padding: "8px 20px",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600"
            }}
          >
            {sending ? "Sending..." : "Send Email Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div className="loading-spinner" style={{ margin: "0 auto 12px" }} />
            <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading...</div>
          </div>
        </main>
      </div>
    }>
      <PipelineContent />
    </Suspense>
  );
}
