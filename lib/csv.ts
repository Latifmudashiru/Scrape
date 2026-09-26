import { ChannelResult } from "./youtube";
import { WhopProduct } from "./whop";
import { SkoolProduct } from "./skool";
import { ContactInfo } from "./enrich";
import { InstagramLead } from "./instagram";

export interface NormalizedLead {
  platform: "YouTube" | "Whop" | "Skool" | "Instagram";
  name: string;
  link: string;
  description: string;
  price: string;
  audienceSize: string;
  emails: string;
  socials: string;
}

export function downloadCSV(data: NormalizedLead[], filename: string) {
  // CSV Headers
  const headers = [
    "Platform",
    "Name",
    "Link",
    "Price",
    "Audience Size",
    "Emails",
    "Socials",
    "Description",
  ];

  // Map data to rows
  const rows = data.map((item) => {
    return [
      item.platform,
      `"${item.name.replace(/"/g, '""')}"`,
      item.link,
      `"${item.price.replace(/"/g, '""')}"`,
      `"${item.audienceSize.replace(/"/g, '""')}"`,
      `"${item.emails.replace(/"/g, '""')}"`,
      `"${item.socials.replace(/"/g, '""')}"`,
      `"${item.description.replace(/"/g, '""')}"`,
    ];
  });

  // Combine headers and rows
  const csvContent =
    headers.join(",") + "\n" + rows.map((e) => e.join(",")).join("\n");

  // Create a blob and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Utility to merge arrays of contact strings into a single formatted string
function formatContacts(contacts?: string[]): string {
  if (!contacts || contacts.length === 0) return "";
  return contacts.join(" | ");
}

// Format YouTube data
export function normalizeYouTube(
  channels: (ChannelResult & { contactInfo?: ContactInfo })[]
): NormalizedLead[] {
  return channels.map((ch) => ({
    platform: "YouTube",
    name: ch.title,
    link: `https://youtube.com/channel/${ch.id}`,
    description: ch.description.replace(/\n/g, " "),
    price: "N/A",
    audienceSize: ch.subscriberCount.toString(),
    emails: formatContacts(ch.contactInfo?.emails),
    socials: formatContacts(ch.contactInfo?.socials),
  }));
}

// Format Whop data
export function normalizeWhop(
  products: (WhopProduct & { contactInfo?: ContactInfo })[]
): NormalizedLead[] {
  return products.map((p) => ({
    platform: "Whop",
    name: p.title,
    link: p.url,
    description: p.description.replace(/\n/g, " "),
    price: p.price,
    audienceSize: "N/A",
    emails: formatContacts(p.contactInfo?.emails),
    socials: formatContacts(p.contactInfo?.socials),
  }));
}

// Format Skool data
export function normalizeSkool(
  products: (SkoolProduct & { contactInfo?: ContactInfo })[]
): NormalizedLead[] {
  return products.map((p) => ({
    platform: "Skool",
    name: p.title,
    link: p.url,
    description: p.description.replace(/\n/g, " "),
    price: p.price,
    audienceSize: p.members || "N/A",
    emails: formatContacts(p.contactInfo?.emails),
    socials: formatContacts(p.contactInfo?.socials),
  }));
}

// Format Instagram data
export function normalizeInstagram(
  leads: InstagramLead[]
): NormalizedLead[] {
  return leads.map((l) => ({
    platform: "Instagram",
    name: l.name,
    link: l.url,
    description: l.description.replace(/\n/g, " "),
    price: "N/A",
    audienceSize: l.followers || "N/A",
    emails: formatContacts(l.emails),
    socials: formatContacts(l.socials),
  }));
}
