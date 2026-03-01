/**
 * RTMP/HLS Streaming Server
 *
 * This server handles:
 * - RTMP ingest from OBS/streaming clients (port 1935)
 * - HLS playback for web viewers (port 8000)
 *
 * Stream keys are validated against the main app's database via HTTP API.
 * Format: tokenAddress-randomSecret (e.g., "0x123...abc-def456")
 */

import NodeMediaServer from "node-media-server";
import config from "./config";
import { promises as fs } from "fs";

// Ensure media directories exist
async function ensureMediaDirs() {
  const mediaRoot = config.http.mediaroot;
  const hlsRoot = config.custom.hlsRoot;

  try {
    await fs.mkdir(mediaRoot, { recursive: true });
    await fs.mkdir(hlsRoot, { recursive: true });
    console.log(`[stream] Media directories ready: ${mediaRoot}`);
  } catch (error: any) {
    console.error("[stream] Failed to create media directories:", error.message);
  }
}

function buildWebhookHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const webhookSecret =
    process.env.STREAM_WEBHOOK_SECRET || process.env.IVS_WEBHOOK_SECRET || "";
  if (webhookSecret) {
    headers["x-stream-webhook-secret"] = webhookSecret;
  }

  return headers;
}

/**
 * Validate stream key by checking with main app API
 * Stream key format: tokenAddress-randomSecret
 */
async function validateStreamKey(
  streamKey: string
): Promise<{ valid: boolean; tokenAddress?: string }> {
  try {
    // Extract token address from stream key (format: tokenAddress-randomSecret)
    const parts = streamKey.split("-");
    if (parts.length < 2) {
      return { valid: false };
    }

    // Reconstruct token address from stream key prefix.
    let tokenAddress = streamKey;
    if (streamKey.startsWith("token_")) {
      tokenAddress = streamKey.replace("token_", "");
      if (tokenAddress.length >= 42) {
        tokenAddress = tokenAddress.substring(0, 42);
      }
    } else {
      const addressMatch = streamKey.match(/^(0x[a-fA-F0-9]{40})/);
      if (addressMatch) {
        tokenAddress = addressMatch[1];
      } else {
        return { valid: false };
      }
    }

    if (!tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
      return { valid: false };
    }

    const apiBase = process.env.MAIN_APP_URL || "http://localhost:3000";
    const response = await fetch(
      `${apiBase}/api/stream/validate?streamKey=${encodeURIComponent(streamKey)}&tokenAddress=${encodeURIComponent(tokenAddress)}`,
      {
        method: "GET",
        headers: buildWebhookHeaders(),
        signal: AbortSignal.timeout(2000),
      }
    ).catch(() => null);

    if (response && response.ok) {
      const data = await response.json();
      return {
        valid: data.valid === true,
        tokenAddress: data.tokenAddress || tokenAddress,
      };
    }

    if (response && !response.ok) {
      console.warn(
        `[stream] Validation rejected by API (${response.status}) for key: ${streamKey.substring(0, 20)}...`
      );
      return { valid: false };
    }

    // Development-only fallback for local iteration.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[stream] Validation API unavailable in development, allowing key: ${streamKey.substring(0, 20)}...`
      );
      return { valid: true, tokenAddress };
    }

    console.error(
      `[stream] Validation API unavailable in production, rejecting key: ${streamKey.substring(0, 20)}...`
    );
    return { valid: false };
  } catch (error: any) {
    console.error("[stream] Stream key validation error:", error.message);
    const isDev = process.env.NODE_ENV !== "production";
    return { valid: isDev };
  }
}

// Initialize Node Media Server
const nms = new NodeMediaServer(config);

// Hook: Before stream is published (OBS connects)
nms.on("prePublish", async (id: string, StreamPath: string, args: any) => {
  console.log(`[NodeEvent on prePublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);

  // Extract stream key from path
  // Path format: /live/STREAM_KEY
  const pathParts = StreamPath.split("/");
  const streamKey = pathParts[pathParts.length - 1];

  if (!streamKey) {
    console.error(`[stream] Invalid stream path: ${StreamPath}`);
    const session = nms.getSession(id);
    session?.reject();
    return;
  }

  console.log(`[stream] Validating stream key: ${streamKey.substring(0, 20)}...`);

  // Validate stream key
  const validation = await validateStreamKey(streamKey);

  if (!validation.valid) {
    console.error(`[stream] Stream key validation failed: ${streamKey.substring(0, 20)}...`);
    const session = nms.getSession(id);
    session?.reject();
    return;
  }

  console.log(`[stream] Stream key validated for token: ${validation.tokenAddress}`);

  // Notify main app that stream started
  try {
    const apiBase = process.env.MAIN_APP_URL || "http://localhost:3000";
    await fetch(`${apiBase}/api/stream/on-publish`, {
      method: "POST",
      headers: buildWebhookHeaders(),
      body: JSON.stringify({
        streamKey,
        tokenAddress: validation.tokenAddress,
        streamPath: StreamPath,
      }),
    }).catch((err) => {
      console.warn("[stream] Failed to notify main app of stream start:", err.message);
    });
  } catch {
    // Non-critical, continue.
  }
});

// Hook: When stream is done (OBS disconnects)
nms.on("donePublish", (id: string, StreamPath: string) => {
  console.log(`[NodeEvent on donePublish] id=${id} StreamPath=${StreamPath}`);

  // Extract stream key
  const pathParts = StreamPath.split("/");
  const streamKey = pathParts[pathParts.length - 1];

  // Notify main app that stream stopped
  fetch(`${process.env.MAIN_APP_URL || "http://localhost:3000"}/api/stream/on-done`, {
    method: "POST",
    headers: buildWebhookHeaders(),
    body: JSON.stringify({ streamKey, streamPath: StreamPath }),
  }).catch(() => {
    // Non-critical.
  });
});

// Hook: When someone connects to play HLS
nms.on("prePlay", (id: string, StreamPath: string, args: any) => {
  console.log(`[NodeEvent on prePlay] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // Allow all playback (can add auth here if needed)
});

// Start server
async function start() {
  await ensureMediaDirs();

  nms.run();

  console.log(`
==========================================================
polPUMP Streaming Server Started
RTMP Ingest:  rtmp://localhost:${config.rtmp.port}/live
HLS Playback: http://localhost:${config.http.port}/live/STREAM_KEY/index.m3u8
==========================================================
`);
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("[stream] Shutting down streaming server...");
  nms.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[stream] Shutting down streaming server...");
  nms.stop();
  process.exit(0);
});

start().catch((error) => {
  console.error("[stream] Failed to start streaming server:", error);
  process.exit(1);
});
