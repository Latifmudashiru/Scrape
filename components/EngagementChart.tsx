"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { ChannelResult } from "@/lib/youtube";

const COLORS = ["#a78bfa", "#22d3ee", "#34d399", "#fb923c", "#f472b6",
  "#818cf8", "#38bdf8", "#4ade80", "#fbbf24", "#f87171"];

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
}

interface Props {
  channels: ChannelResult[];
}

export default function EngagementChart({ channels }: Props) {
  if (channels.length === 0) return null;

  const data = channels
    .slice(0, 10)
    .map((ch) => ({
      name: ch.title.length > 18 ? ch.title.slice(0, 18) + "…" : ch.title,
      subscribers: ch.subscriberCount,
      viewsPerVideo: ch.engagementScore,
    }));

  return (
    <div className="chart-container animate-in">
      <div className="chart-header">
        <div className="chart-title"> Channel Comparison — Views per Video</div>
        <div className="chart-legend">
          <div className="chart-legend-item">
            <div className="chart-legend-dot" style={{ background: "#a78bfa" }} />
            Views/Video
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#8888a0", fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fill: "#8888a0", fontSize: 11 }}
            tickFormatter={formatNumber}
          />
          <Tooltip
            contentStyle={{
              background: "#15152a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 13,
              color: "#f0f0f5",
            }}
            formatter={(value: any) => [formatNumber(Number(value)), "Views/Video"]}
          />
          <Bar dataKey="viewsPerVideo" radius={[6, 6, 0, 0]} barSize={36}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
