"use client";

interface StatsCardProps {
  label: string;
  value: string;
  detail?: string;
  icon: string;
  color: "purple" | "cyan" | "green" | "orange" | "pink";
}

export default function StatsCard({ label, value, detail, icon, color }: StatsCardProps) {
  return (
    <div className="stat-card animate-in">
      <div className="stat-card-label">
        <span>{icon}</span> {label}
      </div>
      <div className={`stat-card-value ${color}`}>{value}</div>
      {detail && <div className="stat-card-detail">{detail}</div>}
    </div>
  );
}
