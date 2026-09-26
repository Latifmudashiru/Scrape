"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

interface EmailTemplate {
  id?: string;
  name: string;
  subject: string;
  body: string;
  created_at?: string;
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/outreach/templates");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data || []);
        if (data.data && data.data.length > 0) {
          handleSelectTemplate(data.data[0]);
        } else {
          handleNewTemplate();
        }
      }
    } catch (e) {
      console.error("Error loading templates:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (t: EmailTemplate) => {
    setSelectedTemplate(t);
    setFormName(t.name);
    setFormSubject(t.subject);
    setFormBody(t.body);
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setFormName("New Template");
    setFormSubject("Subject for {business_name}");
    setFormBody("Hi {director_name},\n\nMy name is {sender_name}...\n\nBest,\n{sender_name}");
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSubject.trim() || !formBody.trim()) {
      alert("All fields are required!");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/outreach/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTemplate?.id,
          name: formName,
          subject: formSubject,
          body: formBody,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Template saved successfully!");
        const saved = data.data;
        // Reload list
        const resList = await fetch("/api/outreach/templates");
        const listData = await resList.json();
        if (listData.success) {
          setTemplates(listData.data || []);
          const updatedSelected = (listData.data || []).find((t: any) => t.id === saved.id);
          if (updatedSelected) {
            handleSelectTemplate(updatedSelected);
          }
        }
      } else {
        alert("Save failed: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate?.id) return;
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      const res = await fetch(`/api/outreach/templates?id=${selectedTemplate.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        alert("Template deleted.");
        fetchTemplates();
      } else {
        alert("Delete failed: " + data.error);
      }
    } catch (err: any) {
      alert("Error deleting: " + err.message);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-content">
          <h1 className="page-title animate-in">
            <span className="page-title-gradient">Email outreach</span> templates
          </h1>
          <p className="page-subtitle animate-in delay-1">
            Create reusable templates. Use brackets to dynamically insert lead and sender variables.
          </p>

          <div style={{ display: "flex", gap: "24px", marginTop: "24px", flexWrap: "wrap" }} className="animate-in delay-2">
            {/* Sidebar list of templates */}
            <div style={{
              flex: "0 0 260px",
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: "14px", fontFamily: "'Space Grotesk', sans-serif" }}>Templates</span>
                <button
                  onClick={handleNewTemplate}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#6d28d9",
                    fontWeight: 600,
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  + Add New
                </button>
              </div>

              {loading ? (
                <div style={{ fontSize: "12px", color: "#999", padding: "20px 0", textAlign: "center" }}>Loading...</div>
              ) : templates.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#999", padding: "20px 0", textAlign: "center" }}>No templates. Click add new above.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {templates.map((t) => {
                    const isSel = selectedTemplate?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleSelectTemplate(t)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: isSel ? 600 : 400,
                          background: isSel ? "rgba(109, 40, 217, 0.08)" : "transparent",
                          color: isSel ? "#6d28d9" : "#333",
                          border: isSel ? "1px solid #6d28d9" : "1px solid transparent",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        {t.name}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Template Editor Form */}
            <div style={{
              flex: 1,
              minWidth: "320px",
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", marginBottom: "6px" }}>Template Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Cold Outreach"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", marginBottom: "6px" }}>Subject Line</label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="e.g. Question about {business_name}"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase" }}>Email Body</label>
                  <div style={{ fontSize: "11px", color: "#888" }}>
                    Tags: <code style={{ background: "#eee", padding: "2px 4px", borderRadius: 4 }}>{"{business_name}"}</code> <code style={{ background: "#eee", padding: "2px 4px", borderRadius: 4 }}>{"{director_name}"}</code> <code style={{ background: "#eee", padding: "2px 4px", borderRadius: 4 }}>{"{sender_name}"}</code> <code style={{ background: "#eee", padding: "2px 4px", borderRadius: 4 }}>{"{phone_number}"}</code>
                  </div>
                </div>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={14}
                  placeholder="Enter template body here..."
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "6px",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    fontFamily: "inherit",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e5e5", paddingTop: "20px" }}>
                <div>
                  {selectedTemplate?.id && (
                    <button
                      onClick={handleDelete}
                      style={{
                        padding: "10px 16px",
                        background: "none",
                        border: "1px solid #ef4444",
                        color: "#ef4444",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Delete Template
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: "10px 20px",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {saving ? "Saving..." : "Save Template"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
