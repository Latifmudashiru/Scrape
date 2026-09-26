import { NextRequest, NextResponse } from "next/server";
import { getChannelStats, getChannelVideos } from "@/lib/youtube";

export async function POST(request: NextRequest) {
  try {
    const { channelId, includeVideos = false, maxVideos = 10 } = await request.json();

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      );
    }

    const channel = await getChannelStats(channelId);
    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    let videos = null;
    if (includeVideos) {
      videos = await getChannelVideos(channelId, maxVideos);
    }

    return NextResponse.json({ channel, videos });
  } catch (error: unknown) {
    console.error("Channel fetch error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch channel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
