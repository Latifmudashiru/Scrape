"use client";

import { VideoResult } from "@/lib/youtube";
import { useState } from "react";

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
}

function getEngagementLevel(rate: number) {
  if (rate >= 5) return { label: " High", cls: "high" };
  if (rate >= 2) return { label: " Medium", cls: "medium" };
  return { label: " Low", cls: "low" };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 365) return Math.floor(days / 365) + "y ago";
  if (days > 30) return Math.floor(days / 30) + "mo ago";
  if (days > 0) return days + "d ago";
  return "Today";
}

interface Props {
  videos: VideoResult[];
  title?: string;
}

type SortKey = "viewCount" | "likeCount" | "commentCount" | "engagementRate";

export default function VideoTable({ videos, title = " Top Videos" }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("viewCount");
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = [...videos].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDesc ? -diff : diff;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDesc ? " ↓" : " ↑") : "";

  if (videos.length === 0) return null;

  return (
    <div className="data-table-container animate-in">
      <div className="data-table-header">
        <div className="data-table-title">{title}</div>
        <div className="data-table-count">{videos.length} videos</div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Video</th>
              <th>Channel</th>
              <th onClick={() => handleSort("viewCount")} style={{ cursor: "pointer" }}>
                Views{arrow("viewCount")}
              </th>
              <th onClick={() => handleSort("likeCount")} style={{ cursor: "pointer" }}>
                Likes{arrow("likeCount")}
              </th>
              <th onClick={() => handleSort("commentCount")} style={{ cursor: "pointer" }}>
                Comments{arrow("commentCount")}
              </th>
              <th onClick={() => handleSort("engagementRate")} style={{ cursor: "pointer" }}>
                Engagement{arrow("engagementRate")}
              </th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => {
              const eng = getEngagementLevel(v.engagementRate);
              return (
                <tr key={v.id}>
                  <td>
                    <div className="video-cell">
                      {v.thumbnail && (
                        <img src={v.thumbnail} alt="" className="video-thumb" />
                      )}
                      <a
                        href={`https://youtube.com/watch?v=${v.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="video-title"
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {v.title}
                      </a>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {v.channelTitle}
                  </td>
                  <td className="number-cell">{formatNumber(v.viewCount)}</td>
                  <td className="number-cell">{formatNumber(v.likeCount)}</td>
                  <td className="number-cell">{formatNumber(v.commentCount)}</td>
                  <td>
                    <span className={`engagement-badge ${eng.cls}`}>
                      {eng.label} ({v.engagementRate.toFixed(1)}%)
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {timeAgo(v.publishedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
