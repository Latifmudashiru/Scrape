"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // If user is already logged in, redirect to scraper page directly
    const storedUser = localStorage.getItem("crm_user");
    if (storedUser) {
      router.push("/gmt/scraper");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    if (!email || !password) {
      setErrorMsg("All fields are required");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email,
          password
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      if (data.success && data.user) {
        localStorage.setItem("crm_user", JSON.stringify(data.user));
        window.dispatchEvent(new Event("storage"));
        router.push("/gmt/scraper");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 10% 20%, rgb(242, 235, 243) 0%, rgb(245, 245, 245) 90.1%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
          width: "100%",
          maxWidth: "420px",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px"
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "20px",
              fontWeight: 800,
              fontFamily: "'Space Grotesk', sans-serif",
              margin: "0 auto 16px auto",
              boxShadow: "0 4px 12px rgba(109, 40, 217, 0.2)"
            }}
          >
            G
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: "#111111", margin: "0 0 6px 0" }}>
            Welcome Back
          </h2>
          <p style={{ fontSize: "14px", color: "#888888", margin: 0 }}>
            Sign in to access GMT Outreach CRM
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              lineHeight: 1.4
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#888888", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.5px" }}>Email Address</label>
            <input
              type="email"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                background: "#fafafa"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#888888", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.5px" }}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                background: "#fafafa"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px",
              background: "linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(109, 40, 217, 0.15)",
              marginTop: "8px"
            }}
          >
            {loading ? "Please wait..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
