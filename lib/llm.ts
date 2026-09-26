import { NormalizedLead } from "./csv";

/**
 * Generate a personalized direct message for a lead using OpenAI or Gemini API.
 */
export async function generateOutreachMessage(
  lead: NormalizedLead,
  niche: string,
  customPrompt: string,
  geminiApiKey?: string
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const envGeminiKey = process.env.GEMINI_API_KEY;
  const activeGeminiKey = geminiApiKey || envGeminiKey;

  if (!openaiKey && !activeGeminiKey) {
    throw new Error(
      "Missing API key. Please configure OPENAI_API_KEY in your .env.local file or supply a Gemini API Key."
    );
  }

  const defaultPrompt = `Write an extremely short, casual, and informal direct message to start a conversation.
Creator details:
- Name: ${lead.name}
- Platform: ${lead.platform}
- Niche: ${niche}
- Bio/Description: ${lead.description || ""}

Rules:
1. Make it sound like a quick, casual text message sent from a phone (lowercase or casual punctuation is fine, no formal business language, no corporate jargon, no sales-y pitch).
2. Structure: 
   - Start with a casual greeting like "hey ${lead.name.split(' ')[0]}" or "hey" or "yo".
   - Say something brief about their profile/content (e.g. "saw your ${lead.platform} page on ${niche}" or "saw you do ${niche} on ${lead.platform}").
   - Ask a simple question: "do you still do coaching?", "do you do coaching?", or "do you have a community?".
3. Length: Maximum 1 or 2 sentences. Keep it under 140 characters.
4. Do NOT use emojis.
5. Do NOT include any placeholders or subject lines. Return ONLY the raw direct message text.`;

  const promptText = customPrompt
    ? customPrompt
        .replace(/{platform}/g, lead.platform)
        .replace(/{name}/g, lead.name)
        .replace(/{niche}/g, niche)
        .replace(/{description}/g, lead.description || "N/A")
        .replace(/{socials}/g, lead.socials || "N/A")
    : defaultPrompt;

  // Prioritize OpenAI if key is present in environment
  if (openaiKey) {
    console.log("Generating message using OpenAI (gpt-4o-mini)...");
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: promptText,
            },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || `OpenAI API returned status ${response.status}`
        );
      }

      const data = await response.json();
      let message = data?.choices?.[0]?.message?.content;
      if (!message) {
        throw new Error("No message content returned by OpenAI");
      }

      message = message.trim();
      if (message.startsWith('"') && message.endsWith('"')) {
        message = message.slice(1, -1).trim();
      }
      return message;
    } catch (error: any) {
      console.error("OpenAI Generation Error:", error);
      throw new Error(`Failed to generate message via OpenAI: ${error.message}`);
    }
  }

  // Fallback to Gemini API
  console.log("Generating message using Gemini (gemini-2.5-flash)...");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeGeminiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: promptText,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.error?.message || `Gemini API returned status ${response.status}`
      );
    }

    const data = await response.json();
    let message = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!message) {
      throw new Error("No text returned in Gemini response");
    }

    message = message.trim();
    if (message.startsWith('"') && message.endsWith('"')) {
      message = message.slice(1, -1).trim();
    }

    return message;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    throw new Error(`Failed to generate message via Gemini: ${error.message}`);
  }
}
