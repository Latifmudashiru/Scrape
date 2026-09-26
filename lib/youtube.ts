import { google } from "googleapis";

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

export interface ChannelResult {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  customUrl: string;
  publishedAt: string;
  engagementScore: number;
}

export interface VideoResult {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  engagementRate: number;
  duration: string;
}

export interface NicheAnalysis {
  query: string;
  channels: ChannelResult[];
  topVideos: VideoResult[];
  stats: {
    totalChannels: number;
    avgSubscribers: number;
    avgViews: number;
    avgEngagement: number;
    totalVideosAnalyzed: number;
  };
  timestamp: string;
}

// Search for channels by keyword
export async function searchChannels(
  query: string,
  maxResults: number = 10
): Promise<ChannelResult[]> {
  const searchResponse = await youtube.search.list({
    part: ["snippet"],
    q: query,
    type: ["channel"],
    maxResults,
    order: "relevance",
  });

  const channelIds =
    searchResponse.data.items
      ?.map((item) => item.snippet?.channelId || item.id?.channelId)
      .filter(Boolean) || [];

  if (channelIds.length === 0) return [];

  const channelsResponse = await youtube.channels.list({
    part: ["snippet", "statistics", "brandingSettings"],
    id: channelIds as string[],
  });

  return (
    channelsResponse.data.items?.map((channel) => {
      const stats = channel.statistics;
      const viewCount = parseInt(stats?.viewCount || "0");
      const videoCount = parseInt(stats?.videoCount || "1");
      const subscriberCount = parseInt(stats?.subscriberCount || "0");

      return {
        id: channel.id || "",
        title: channel.snippet?.title || "",
        description: channel.snippet?.description || "",
        thumbnail:
          channel.snippet?.thumbnails?.medium?.url ||
          channel.snippet?.thumbnails?.default?.url ||
          "",
        subscriberCount,
        viewCount,
        videoCount,
        customUrl: channel.snippet?.customUrl || "",
        publishedAt: channel.snippet?.publishedAt || "",
        engagementScore:
          videoCount > 0 ? Math.round(viewCount / videoCount) : 0,
      };
    }) || []
  );
}

// Search for videos by keyword
export async function searchVideos(
  query: string,
  maxResults: number = 15
): Promise<VideoResult[]> {
  const searchResponse = await youtube.search.list({
    part: ["snippet"],
    q: query,
    type: ["video"],
    maxResults,
    order: "viewCount",
  });

  const videoIds =
    searchResponse.data.items
      ?.map((item) => item.id?.videoId)
      .filter(Boolean) || [];

  if (videoIds.length === 0) return [];

  const videosResponse = await youtube.videos.list({
    part: ["snippet", "statistics", "contentDetails"],
    id: videoIds as string[],
  });

  return (
    videosResponse.data.items?.map((video) => {
      const stats = video.statistics;
      const viewCount = parseInt(stats?.viewCount || "0");
      const likeCount = parseInt(stats?.likeCount || "0");
      const commentCount = parseInt(stats?.commentCount || "0");
      const engagementRate =
        viewCount > 0 ? ((likeCount + commentCount) / viewCount) * 100 : 0;

      return {
        id: video.id || "",
        title: video.snippet?.title || "",
        description: video.snippet?.description || "",
        thumbnail:
          video.snippet?.thumbnails?.medium?.url ||
          video.snippet?.thumbnails?.default?.url ||
          "",
        channelTitle: video.snippet?.channelTitle || "",
        channelId: video.snippet?.channelId || "",
        publishedAt: video.snippet?.publishedAt || "",
        viewCount,
        likeCount,
        commentCount,
        engagementRate: Math.round(engagementRate * 1000) / 1000,
        duration: video.contentDetails?.duration || "",
      };
    }) || []
  );
}

// Get detailed stats for a specific channel
export async function getChannelStats(
  channelId: string
): Promise<ChannelResult | null> {
  const response = await youtube.channels.list({
    part: ["snippet", "statistics", "brandingSettings"],
    id: [channelId],
  });

  const channel = response.data.items?.[0];
  if (!channel) return null;

  const stats = channel.statistics;
  const viewCount = parseInt(stats?.viewCount || "0");
  const videoCount = parseInt(stats?.videoCount || "1");
  const subscriberCount = parseInt(stats?.subscriberCount || "0");

  return {
    id: channel.id || "",
    title: channel.snippet?.title || "",
    description: channel.snippet?.description || "",
    thumbnail:
      channel.snippet?.thumbnails?.medium?.url ||
      channel.snippet?.thumbnails?.default?.url ||
      "",
    subscriberCount,
    viewCount,
    videoCount,
    customUrl: channel.snippet?.customUrl || "",
    publishedAt: channel.snippet?.publishedAt || "",
    engagementScore: videoCount > 0 ? Math.round(viewCount / videoCount) : 0,
  };
}

// Get recent videos from a channel
export async function getChannelVideos(
  channelId: string,
  maxResults: number = 10
): Promise<VideoResult[]> {
  // First get the uploads playlist
  const channelResponse = await youtube.channels.list({
    part: ["contentDetails"],
    id: [channelId],
  });

  const uploadsPlaylistId =
    channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return [];

  // Get videos from the uploads playlist
  const playlistResponse = await youtube.playlistItems.list({
    part: ["snippet"],
    playlistId: uploadsPlaylistId,
    maxResults,
  });

  const videoIds =
    playlistResponse.data.items
      ?.map((item) => item.snippet?.resourceId?.videoId)
      .filter(Boolean) || [];

  if (videoIds.length === 0) return [];

  // Get full video stats
  const videosResponse = await youtube.videos.list({
    part: ["snippet", "statistics", "contentDetails"],
    id: videoIds as string[],
  });

  return (
    videosResponse.data.items?.map((video) => {
      const stats = video.statistics;
      const viewCount = parseInt(stats?.viewCount || "0");
      const likeCount = parseInt(stats?.likeCount || "0");
      const commentCount = parseInt(stats?.commentCount || "0");
      const engagementRate =
        viewCount > 0 ? ((likeCount + commentCount) / viewCount) * 100 : 0;

      return {
        id: video.id || "",
        title: video.snippet?.title || "",
        description: video.snippet?.description || "",
        thumbnail:
          video.snippet?.thumbnails?.medium?.url ||
          video.snippet?.thumbnails?.default?.url ||
          "",
        channelTitle: video.snippet?.channelTitle || "",
        channelId: video.snippet?.channelId || "",
        publishedAt: video.snippet?.publishedAt || "",
        viewCount,
        likeCount,
        commentCount,
        engagementRate: Math.round(engagementRate * 1000) / 1000,
        duration: video.contentDetails?.duration || "",
      };
    }) || []
  );
}

// Full niche analysis pipeline
export async function analyzeNiche(
  query: string
): Promise<NicheAnalysis> {
  // Step 1: Find channels
  const channels = await searchChannels(query, 100);

  // Step 2: Find top videos
  const topVideos = await searchVideos(query, 15);

  // Step 3: Calculate aggregate stats
  const totalChannels = channels.length;
  const avgSubscribers =
    totalChannels > 0
      ? Math.round(
          channels.reduce((sum, c) => sum + c.subscriberCount, 0) /
            totalChannels
        )
      : 0;
  const avgViews =
    totalChannels > 0
      ? Math.round(
          channels.reduce((sum, c) => sum + c.viewCount, 0) / totalChannels
        )
      : 0;
  const avgEngagement =
    topVideos.length > 0
      ? Math.round(
          (topVideos.reduce((sum, v) => sum + v.engagementRate, 0) /
            topVideos.length) *
            1000
        ) / 1000
      : 0;

  return {
    query,
    channels,
    topVideos,
    stats: {
      totalChannels,
      avgSubscribers,
      avgViews,
      avgEngagement,
      totalVideosAnalyzed: topVideos.length,
    },
    timestamp: new Date().toISOString(),
  };
}
