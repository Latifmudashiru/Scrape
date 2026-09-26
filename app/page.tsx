"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("crm_user");
    if (!storedUser) {
      router.push("/login");
    } else {
      router.push("/gmt/scraper");
    }
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyItems: "center", background: "#ffffff" }}>
      <div style={{ margin: "auto", fontSize: "14px", color: "#888888", fontFamily: "'Inter', sans-serif" }}>
        Redirecting...
      </div>
    </div>
  );
}
