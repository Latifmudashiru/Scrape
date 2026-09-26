"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const isGmt = pathname?.startsWith("/gmt") || pathname?.startsWith("/pipeline");

  useEffect(() => {
    const stored = localStorage.getItem("crm_user");
    if (!stored && pathname !== "/login") {
      router.push("/login");
    } else if (stored) {
      setUser(JSON.parse(stored));
    }

    const handleStorageChange = () => {
      const u = localStorage.getItem("crm_user");
      setUser(u ? JSON.parse(u) : null);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [pathname, router]);

  // SVG Icons
  const searchIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }}>
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  );

  const mailIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22,6 12,13 2,6"></polyline>
    </svg>
  );

  const briefIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }}>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>
  );

  const listIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }}>
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  );

  const binIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }}>
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  );

  const backIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }}>
      <line x1="19" y1="12" x2="5" y2="12"></line>
      <polyline points="12,19 5,12 12,5"></polyline>
    </svg>
  );

  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isGmt) return;

    const checkCallbacks = async () => {
      try {
        const res = await fetch("/api/gmt/leads");
        const data = await res.json();
        if (data.success && data.data) {
          const now = new Date();
          const dueLeads = data.data.filter((l: any) => {
            if (l.price !== "Call Later") return false;
            if (dismissedAlerts[l.id]) return false;
            try {
              const crm = JSON.parse(l.emails || "{}");
              if (!crm.callbackTime) return false;
              const callbackTime = new Date(crm.callbackTime);
              
              // Alert if callback is scheduled within 10 minutes, OR if it is already past due (overdue)
              const diffMs = callbackTime.getTime() - now.getTime();
              const diffMins = diffMs / (60 * 1000);
              
              return diffMins <= 10;
            } catch {
              return false;
            }
          });
          setActiveAlerts(dueLeads);
        }
      } catch (err) {
        console.error("Failed to fetch callback alerts:", err);
      }
    };

    checkCallbacks();
    const interval = setInterval(checkCallbacks, 20000); // Check every 20 seconds
    return () => clearInterval(interval);
  }, [isGmt, dismissedAlerts]);

  if (isGmt) {
    return (
      <>
        <aside className="sidebar">
        <div className="sidebar-header">
          <Link href="/gmt" className="sidebar-logo">
            <div className="sidebar-logo-icon">G</div>
            <div>
              <div className="sidebar-logo-text">GMT Solutions</div>
              <div className="sidebar-logo-sub">Cleaning Lead Finder</div>
            </div>
          </Link>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Overview</div>
          <Link href="/gmt/scraper" className={`sidebar-link ${pathname === "/gmt/scraper" ? "active" : ""}`}>
            <span className="sidebar-link-icon">{searchIcon}</span>
            Scraper
          </Link>
          <Link href="/gmt" className={`sidebar-link ${pathname === "/gmt" ? "active" : ""}`}>
            <span className="sidebar-link-icon">{listIcon}</span>
            Lead List
          </Link>
          <Link href="/gmt/tasks" className={`sidebar-link ${pathname === "/gmt/tasks" ? "active" : ""}`}>
            <span className="sidebar-link-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </span>
            Follow Ups
          </Link>
          <Link href="/gmt/bin" className={`sidebar-link ${pathname === "/gmt/bin" ? "active" : ""}`}>
            <span className="sidebar-link-icon">{binIcon}</span>
            Bin
          </Link>
          <Link href="/pipeline" className={`sidebar-link ${pathname === "/pipeline" ? "active" : ""}`}>
            <span className="sidebar-link-icon">{mailIcon}</span>
            Pipeline
          </Link>
          <Link href="/pipeline/templates" className={`sidebar-link ${pathname === "/pipeline/templates" ? "active" : ""}`}>
            <span className="sidebar-link-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </span>
            Email Templates
          </Link>
          <Link href="/gmt/clients" className={`sidebar-link ${pathname === "/gmt/clients" ? "active" : ""}`}>
            <span className="sidebar-link-icon">{briefIcon}</span>
            Clients
          </Link>

          <div className="sidebar-section-label" style={{ marginTop: "24px" }}>System</div>
          {user && (
            <div style={{ padding: "8px 12px", fontSize: "11px", color: "#666", background: "#f5f5f5", borderRadius: "6px", marginBottom: "8px", fontWeight: 500 }}>
              Logged in as: <strong style={{ color: "#111" }}>{user.name}</strong>
            </div>
          )}
          <button 
            onClick={() => {
              localStorage.removeItem("crm_user");
              window.dispatchEvent(new Event("storage"));
              router.push("/login");
            }}
            style={{
              width: "100%",
              textAlign: "left",
              border: "none",
              background: "none",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit"
            }}
          >
            <span className="sidebar-link-icon" style={{ color: "#ef4444", display: "flex", alignItems: "center" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </span>
            Log Out
          </button>
        </nav>
      </aside>

      {/* Floating Callback Reminder Popup */}
      {activeAlerts.length > 0 && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 99999,
          background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          color: "#ffffff",
          padding: "16px 20px",
          borderRadius: "10px",
          boxShadow: "0 8px 30px rgba(239, 68, 68, 0.35)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          width: "360px",
          maxWidth: "90vw",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
              CALLBACK DUE NOW
            </span>
            <span style={{ fontSize: "11px", background: "rgba(255,255,255,0.2)", padding: "2px 6px", borderRadius: "10px" }}>
              {activeAlerts.length} total
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "200px", overflowY: "auto" }}>
            {activeAlerts.map((lead) => {
              let timeStr = "Now";
              let phone = "N/A";
              try {
                const crm = JSON.parse(lead.emails || "{}");
                if (crm.callbackTime) {
                  const d = new Date(crm.callbackTime);
                  timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                }
              } catch {}
              const match = lead.socials?.match(/Phone:\s*([^\s|]+(?:\s+[^\s|]+)*)/i);
              if (match) phone = match[1];

              return (
                <div key={lead.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>{lead.name}</div>
                    <div style={{ fontSize: "11px", opacity: 0.9, marginTop: "2px" }}>Time: {timeStr} | Phone: {phone}</div>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <a
                      href={`tel:${phone}`}
                      style={{
                        padding: "3px 8px",
                        background: "#ffffff",
                        color: "#ef4444",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        textDecoration: "none"
                      }}
                    >
                      Call
                    </a>
                    <button
                      onClick={() => {
                        setDismissedAlerts((prev) => ({ ...prev, [lead.id]: true }));
                        setActiveAlerts((prev) => prev.filter((a) => a.id !== lead.id));
                      }}
                      style={{
                        background: "rgba(255, 255, 255, 0.2)",
                        border: "none",
                        color: "#ffffff",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        cursor: "pointer",
                        fontWeight: "bold"
                      }}
                    >
                      X
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link href="/askra" className="sidebar-logo">
          <div className="sidebar-logo-icon">N</div>
          <div>
            <div className="sidebar-logo-text">NicheScope</div>
            <div className="sidebar-logo-sub">Coaching Intelligence</div>
          </div>
        </Link>
      </div>
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Overview</div>
        <Link href="/askra" className={`sidebar-link ${pathname === "/askra" ? "active" : ""}`}>
          <span className="sidebar-link-icon">/</span>
          Dashboard
        </Link>
        <div className="sidebar-section-label">Scrapers</div>
        <Link href="/youtube" className={`sidebar-link ${pathname === "/youtube" ? "active" : ""}`}>
          <span className="sidebar-link-icon">YT</span>
          YouTube
          <span className="sidebar-badge">Live</span>
        </Link>
        <Link href="/whop" className={`sidebar-link ${pathname === "/whop" ? "active" : ""}`}>
          <span className="sidebar-link-icon">W</span>
          Whop
        </Link>
        <Link href="/skool" className={`sidebar-link ${pathname === "/skool" ? "active" : ""}`}>
          <span className="sidebar-link-icon">S</span>
          Skool
        </Link>
        <Link href="/instagram" className={`sidebar-link ${pathname === "/instagram" ? "active" : ""}`}>
          <span className="sidebar-link-icon">IG</span>
          Instagram
        </Link>
        <div className="sidebar-section-label">Tools</div>
        <Link href="/outreach" className={`sidebar-link ${pathname === "/outreach" ? "active" : ""}`}>
          <span className="sidebar-link-icon">DM</span>
          Outreach
        </Link>
        <span className="sidebar-link" style={{ opacity: 0.5 }}>
          <span className="sidebar-link-icon">AI</span>
          AI Insights
          <span className="sidebar-badge coming-soon">Soon</span>
        </span>

        <div className="sidebar-section-label" style={{ marginTop: "24px" }}>System</div>
        <Link href="/" className="sidebar-link">
          <span className="sidebar-link-icon">&larr;</span>
          Switch Workspace
        </Link>
      </nav>
    </aside>
  );
}
