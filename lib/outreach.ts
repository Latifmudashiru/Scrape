import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { supabase } from "./supabase";
import { NormalizedLead } from "./csv";

const LOG_FILE = path.join(process.cwd(), "outreach_status.json");

export interface OutreachLog {
  is_messaged: boolean;
  messaged_at?: string;
  message_sent?: string;
  error?: string;
}

// Global browser reference to reuse across requests
let activeBrowser: any = null;

/**
 * Load local outreach logs.
 */
export function getLocalOutreachLogs(): Record<string, OutreachLog> {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("Failed to read local outreach logs:", e);
  }
  return {};
}

/**
 * Save a local outreach log entry.
 */
export function saveLocalOutreachLog(leadId: string, log: OutreachLog) {
  try {
    const logs = getLocalOutreachLogs();
    logs[leadId] = log;
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write local outreach logs:", e);
  }
}

/**
 * Get or launch the active browser.
 */
export async function getBrowser(headless = false) {
  if (activeBrowser) {
    try {
      // Check if browser is still responsive
      await activeBrowser.version();
      return activeBrowser;
    } catch (e) {
      console.log("Active browser was closed. Launching new one...");
      activeBrowser = null;
    }
  }

  const userDataDir = path.join(process.cwd(), "user_data", "instagram");

  // Make sure directories exist
  if (!fs.existsSync(path.join(process.cwd(), "user_data"))) {
    fs.mkdirSync(path.join(process.cwd(), "user_data"));
  }

  activeBrowser = await puppeteer.launch({
    headless,
    userDataDir,
    defaultViewport: null, // Allow browser to resize naturally
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-notifications",
      "--window-size=1000,800"
    ]
  });

  return activeBrowser;
}

/**
 * Close the active browser.
 */
export async function closeBrowser() {
  if (activeBrowser) {
    try {
      await activeBrowser.close();
    } catch (e) {
      // Ignore
    }
    activeBrowser = null;
  }
}

/**
 * Check if the Puppeteer browser is logged in to Instagram.
 */
export async function checkInstagramLogin(page: any): Promise<boolean> {
  await page.goto("https://www.instagram.com/", { waitUntil: "networkidle2", timeout: 30000 });
  
  // Wait a moment for redirects
  await new Promise(r => setTimeout(r, 2000));
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  
  // If we see "Phone number, username, or email" or "Log In", we are not logged in.
  if (bodyText.includes("Phone number, username, or email") || bodyText.includes("Log in with Facebook") || page.url().includes("/accounts/login/")) {
    return false;
  }
  
  return true;
}

/**
 * Open Instagram login page in a non-headless browser.
 */
export async function openInstagramLogin() {
  const browser = await getBrowser(false);
  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();
  
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  
  console.log("Navigating to Instagram login/home...");
  await page.goto("https://www.instagram.com/", { waitUntil: "networkidle2" });
  
  return browser;
}

/**
 * Send an Instagram DM to a user using Puppeteer.
 */
export async function sendInstagramDM(username: string, message: string): Promise<void> {
  const browser = await getBrowser(false); // Must be non-headless to avoid instant security flags and support login
  const page = await browser.newPage();
  
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  
  try {
    // 1. Check Login
    const isLoggedIn = await checkInstagramLogin(page);
    if (!isLoggedIn) {
      throw new Error("You are not logged in to Instagram. Please click 'Open Instagram Login' and log in first.");
    }
    
    // 2. Navigate to Profile
    console.log(`Navigating to Instagram profile: https://www.instagram.com/${username}/`);
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if profile exists / is blocked
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes("Sorry, this page isn't available") || bodyText.includes("Page Not Found")) {
      throw new Error(`Profile @${username} does not exist or page is unavailable.`);
    }

    // 3. Find and Click the "Message" button
    console.log("Looking for 'Message' button...");
    const clicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("button, a, div[role='button']"));
      const msgBtn = elements.find(
        (el) => el.textContent?.trim().toLowerCase() === "message"
      ) as HTMLElement;
      
      if (msgBtn) {
        msgBtn.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      throw new Error("Could not find the 'Message' button on the profile. Are you following them or is their profile private/restricted?");
    }

    console.log("Clicked Message button. Waiting for direct chat to load...");
    
    // 4. Wait for Chat Room to load
    // Direct chat has a text editor box with role="textbox"
    await page.waitForSelector("div[role='textbox']", { timeout: 25000 });
    await new Promise(r => setTimeout(r, 2000));

    // 5. Type and Send Message
    console.log("Focusing input box and typing message...");
    const textBox = await page.$("div[role='textbox']");
    if (!textBox) {
      throw new Error("Could not locate the message text box.");
    }
    
    await textBox.focus();
    
    // Type character-by-character with variable delay to simulate human typing
    for (const char of message) {
      await page.keyboard.type(char);
      const randomDelay = Math.floor(Math.random() * 80) + 40; // 40ms to 120ms
      await new Promise(r => setTimeout(r, randomDelay));
    }

    // Wait a brief moment
    await new Promise(r => setTimeout(r, 1500));

    // Send: Locate the "Send" button or press "Enter"
    console.log("Sending message...");
    const sentViaBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const sendBtn = buttons.find(
        (btn) => btn.textContent?.trim().toLowerCase() === "send"
      ) as HTMLElement;
      
      if (sendBtn) {
        sendBtn.click();
        return true;
      }
      return false;
    });

    if (!sentViaBtn) {
      // Fallback to pressing Enter key
      await page.keyboard.press("Enter");
    }

    // Wait 3 seconds to let the message send
    await new Promise(r => setTimeout(r, 3000));
    console.log(`Successfully sent message to @${username}`);

  } catch (error) {
    console.error(`Error sending DM to @${username}:`, error);
    throw error;
  } finally {
    await page.close();
  }
}

/**
 * Update the status of a lead in the database and the local JSON file.
 */
export async function updateLeadOutreachStatus(
  leadId: string,
  isMessaged: boolean,
  messageSent?: string,
  errorMessage?: string
) {
  const timestamp = new Date().toISOString();
  
  // 1. Save locally (Always works, zero dependencies)
  saveLocalOutreachLog(leadId, {
    is_messaged: isMessaged,
    messaged_at: timestamp,
    message_sent: messageSent,
    error: errorMessage
  });

  // 2. Try to save to Supabase (if columns exist)
  try {
    const { error } = await supabase
      .from("leads")
      .update({
        is_messaged: isMessaged,
        messaged_at: timestamp,
        message_sent: messageSent
      })
      .eq("id", leadId);

    if (error) {
      console.warn("Supabase outreach columns update failed (this is normal if you haven't added the columns to Supabase yet):", error.message);
    }
  } catch (err: any) {
    console.warn("Supabase update error:", err.message);
  }
}

/**
 * Update the pipeline stage status of a lead in the database.
 */
export async function updateLeadPipelineStatus(
  leadId: string,
  status: "booked_call" | "email_followup" | "text_followup" | "none" | "Closed / Won"
) {
  try {
    let priceStatus = "Pending";
    let dbStatus = status;

    if (status === "email_followup") {
      priceStatus = "Email Follow Up";
    } else if (status === "text_followup") {
      priceStatus = "Text Follow Up";
    } else if (status === "booked_call") {
      priceStatus = "Meeting Scheduled";
    } else if (status === "Closed / Won") {
      priceStatus = "Closed / Won";
      dbStatus = "none"; // Once closed, move it out of the active outreach pipeline columns
    }

    // Save locally
    const logs = getLocalOutreachLogs();
    const currentLog = logs[leadId] || { is_messaged: false };
    saveLocalOutreachLog(leadId, {
      ...currentLog,
      pipeline_status: dbStatus
    } as any);

    let { error } = await supabase
      .from("leads")
      .update({
        pipeline_status: dbStatus,
        price: priceStatus
      })
      .eq("id", leadId);

    // Fallback if pipeline_status column is missing
    if (error && (error.message.includes("column") || error.code === "PGRST204" || error.code === "42703")) {
      console.warn("Retrying update without pipeline_status column:", error.message);
      const { error: retryError } = await supabase
        .from("leads")
        .update({
          price: priceStatus
        })
        .eq("id", leadId);
      error = retryError;
    }

    if (error) {
      console.warn("Supabase update error (pipeline_status):", error.message);
    }
  } catch (err: any) {
    console.warn("Supabase update error (pipeline_status):", err.message);
  }
}

/**
 * Update email/reminder details of a lead in the database.
 */
export async function updateLeadEmailStatus(
  leadId: string,
  emailDetails: any
) {
  try {
    // Save locally
    const logs = getLocalOutreachLogs();
    const currentLog = logs[leadId] || { is_messaged: false };
    saveLocalOutreachLog(leadId, {
      ...currentLog,
      ...emailDetails
    } as any);

    const { error } = await supabase
      .from("leads")
      .update(emailDetails)
      .eq("id", leadId);

    if (error) {
      console.warn("Supabase update error (emailDetails):", error.message);
    }
  } catch (err: any) {
    console.warn("Supabase update error (emailDetails):", err.message);
  }
}

