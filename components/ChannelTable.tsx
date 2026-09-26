"use client";

import { ChannelResult } from "@/lib/youtube";
import { ContactInfo } from "@/lib/enrich";
import { useState } from "react";

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
}

interface EnrichedChannelResult extends ChannelResult {
  contactInfo?: ContactInfo;
}

interface Props {
  channels: EnrichedChannelResult[];
  onViewVideos?: (channelId: string) => void;
}

type SortKey = "subscriberCount" | "viewCount" | "videoCount" | "engagementScore";

export default function ChannelTable({ channels, onViewVideos }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("subscriberCount");
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = [...channels].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDesc ? -diff : diff;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDesc ? " ↓" : " ↑") : "";

  if (channels.length === 0) return null;

  return (
    <div className="data-table-container animate-in">
      <div className="data-table-header">
        <div className="data-table-title"> Channels Found</div>
        <div className="data-table-count">{channels.length} results</div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th onClick={() => handleSort("subscriberCount")} style={{ cursor: "pointer" }}>
                Subscribers{arrow("subscriberCount")}
              </th>
              <th onClick={() => handleSort("viewCount")} style={{ cursor: "pointer" }}>
                Total Views{arrow("viewCount")}
              </th>
              <th onClick={() => handleSort("videoCount")} style={{ cursor: "pointer" }}>
                Videos{arrow("videoCount")}
              </th>
              <th onClick={() => handleSort("engagementScore")} style={{ cursor: "pointer" }}>
                Views/Video{arrow("engagementScore")}
              </th>
              <th>Contacts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ch) => (
              <tr key={ch.id}>
                <td>
                  <div className="channel-cell">
                    {ch.thumbnail && (
                      <img src={ch.thumbnail} alt="" className="channel-avatar" />
                    )}
                    <div>
                      <div className="channel-name">{ch.title}</div>
                      {ch.customUrl && (
                        <div className="channel-handle">{ch.customUrl}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="number-cell">{formatNumber(ch.subscriberCount)}</td>
                <td className="number-cell">{formatNumber(ch.viewCount)}</td>
                <td className="number-cell">{formatNumber(ch.videoCount)}</td>
                <td className="number-cell">{formatNumber(ch.engagementScore)}</td>
                <td>
                  {ch.contactInfo && (ch.contactInfo.emails.length > 0 || ch.contactInfo.socials.length > 0) ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {ch.contactInfo.emails.map(e => (
                        <span key={e} style={{ fontSize: 11, background: "rgba(34, 211, 238, 0.1)", color: "#22d3ee", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>
                           {e}
                        </span>
                      ))}
                      {ch.contactInfo.socials.map(s => (
                        <a key={s} href={s} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, background: "rgba(255, 255, 255, 0.1)", color: "white", padding: "2px 6px", borderRadius: 4, textDecoration: "none", whiteSpace: "nowrap", display: "inline-block" }}>
                          {s.includes('instagram') ? ' Instagram' : s.includes('twitter') || s.includes('x.com') ? ' Twitter' : ' Social'}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>-</span>
                  )}
                </td>
                <td>
                  <button
                    className="expand-btn"
                    onClick={() => onViewVideos?.(ch.id)}
                  >
                    View Videos
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
