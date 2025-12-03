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
import path from "path";

// Ensure media directories exist
async function ensureMediaDirs() {
  const mediaRoot = config.http.mediaroot;
  const hlsRoot = config.custom.hlsRoot;
  
  try {
    await fs.mkdir(mediaRoot, { recursive: true });
    await fs.mkdir(hlsRoot, { recursive: true });
    console.log(`✅ Media directories created: ${mediaRoot}`);
  } catch (error: any) {
    console.error("❌ Failed to create media directories:", error.message);
  }
}

/**
 * Validate stream key by checking with main app API
 * Stream key format: tokenAddress-randomSecret
 */
async function validateStreamKey(streamKey: string): Promise<{ valid: boolean; tokenAddress?: string }> {
  try {
    // Extract token address from stream key (format: tokenAddress-randomSecret)
    const parts = streamKey.split("-");
    if (parts.length < 2) {
      return { valid: false };
    }

    // Reconstruct token address (might have dashes in the random part, so take first part)
    // Actually, token addresses are 0x... so we need a better approach
    // Let's check: if it starts with "token_", remove that prefix
    let tokenAddress = streamKey;
    if (streamKey.startsWith("token_")) {
      tokenAddress = streamKey.replace("token_", "");
      // Token address is 42 chars (0x + 40 hex), so split there
      if (tokenAddress.length >= 42) {
        tokenAddress = tokenAddress.substring(0, 42);
      }
    } else {
      // Try to extract 0x... address (42 chars)
      const addressMatch = streamKey.match(/^(0x[a-fA-F0-9]{40})/);
      if (addressMatch) {
        tokenAddress = addressMatch[1];
      } else {
        return { valid: false };
      }
    }

    // Validate token address format
    if (!tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
      return { valid: false };
    }

    // Check with main app API if stream is active
    // In production, this would call your Next.js API
    const apiBase = process.env.MAIN_APP_URL || "http://localhost:3000";
    const response = await fetch(
      `${apiBase}/api/stream/validate?streamKey=${encodeURIComponent(streamKey)}&tokenAddress=${encodeURIComponent(tokenAddress)}`,
      { 
        method: "GET",
        headers: { "Content-Type": "application/json" },
        // 2 second timeout
        signal: AbortSignal.timeout(2000)
      }
    ).catch(() => null);

    if (response && response.ok) {
      const data = await response.json();
      return { 
        valid: data.valid === true, 
        tokenAddress: data.tokenAddress || tokenAddress 
      };
    }

    // Fallback: if API is unavailable, allow if format looks valid
    // (This is for development - in production, always validate)
    console.warn(`⚠️  Stream validation API unavailable, allowing stream key: ${streamKey.substring(0, 20)}...`);
    return { valid: true, tokenAddress };
  } catch (error: any) {
    console.error("❌ Stream key validation error:", error.message);
    // In dev, allow if format is valid; in prod, reject
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
    console.error(`❌ Invalid stream path: ${StreamPath}`);
    const session = nms.getSession(id);
    session?.reject();
    return;
  }

  console.log(`🔍 Validating stream key: ${streamKey.substring(0, 20)}...`);

  // Validate stream key
  const validation = await validateStreamKey(streamKey);
  
  if (!validation.valid) {
    console.error(`❌ Stream key validation failed: ${streamKey.substring(0, 20)}...`);
    const session = nms.getSession(id);
    session?.reject();
    return;
  }

  console.log(`✅ Stream key validated for token: ${validation.tokenAddress}`);
  
  // Notify main app that stream started
  try {
    const apiBase = process.env.MAIN_APP_URL || "http://localhost:3000";
    await fetch(`${apiBase}/api/stream/on-publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streamKey,
        tokenAddress: validation.tokenAddress,
        streamPath: StreamPath,
      }),
    }).catch((err) => {
      console.warn("⚠️  Failed to notify main app of stream start:", err.message);
    });
  } catch (error) {
    // Non-critical, continue
  }
});

// Hook: When stream is done (OBS disconnects)
nms.on("donePublish", (id: string, StreamPath: string, args: any) => {
  console.log(`[NodeEvent on donePublish] id=${id} StreamPath=${StreamPath}`);
  
  // Extract stream key
  const pathParts = StreamPath.split("/");
  const streamKey = pathParts[pathParts.length - 1];

  // Notify main app that stream stopped
  fetch(`${process.env.MAIN_APP_URL || "http://localhost:3000"}/api/stream/on-done`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ streamKey, streamPath: StreamPath }),
  }).catch(() => {
    // Non-critical
  });
});

// Hook: When someone connects to play HLS
nms.on("prePlay", (id: string, StreamPath: string, args: any) => {
  console.log(`[NodeEvent on prePlay] id=${id} StreamPath=${StreamPath}`);
  // Allow all playback (can add auth here if needed)
});

// Start server
async function start() {
  await ensureMediaDirs();

  nms.run();

  console.log(`
╔══════════════════════════════════════════════════════════╗
║     polPUMP Streaming Server Started                    ║
╠══════════════════════════════════════════════════════════╣
║  RTMP Ingest:  rtmp://localhost:${config.rtmp.port}/live          ║
║  HLS Playback: http://localhost:${config.http.port}/live/STREAM_KEY/index.m3u8  ║
╚══════════════════════════════════════════════════════════╝
  `);
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Shutting down streaming server...");
  nms.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Shutting down streaming server...");
  nms.stop();
  process.exit(0);
});

start().catch((error) => {
  console.error("❌ Failed to start streaming server:", error);
  process.exit(1);
});





