/**
 * Streaming server configuration
 * Configures RTMP ingest and HLS playback using node-media-server
 */

import { config as dotenvConfig } from "dotenv";
import path from "path";

// Load environment variables
dotenvConfig({ path: path.join(__dirname, "../.env") });

// Stream secret for validating stream keys (should match with main app)
const STREAM_SECRET =
  process.env.STREAM_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-stream-secret");

// Ports
const RTMP_PORT = parseInt(process.env.RTMP_PORT || "1935", 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "8000", 10);

const API_USER = process.env.API_USER || (process.env.NODE_ENV === "production" ? "" : "admin");
const API_PASS = process.env.API_PASS || (process.env.NODE_ENV === "production" ? "" : "admin");
const STREAM_ALLOW_ORIGIN =
  process.env.STREAM_ALLOW_ORIGIN ||
  process.env.MAIN_APP_URL ||
  (process.env.NODE_ENV === "production" ? "" : "*");

if (process.env.NODE_ENV === "production") {
  if (!STREAM_SECRET) {
    throw new Error("STREAM_SECRET must be configured in production");
  }
  if (!API_USER || !API_PASS) {
    throw new Error("API_USER and API_PASS must be configured in production");
  }
  if (!STREAM_ALLOW_ORIGIN) {
    throw new Error("STREAM_ALLOW_ORIGIN (or MAIN_APP_URL) must be configured in production");
  }
}

// Media output directory
const MEDIA_ROOT = path.join(__dirname, "../media");
const HLS_ROOT = path.join(MEDIA_ROOT, "hls");

/**
 * Node-Media-Server configuration
 * See: https://github.com/illuspas/Node-Media-Server
 */
const config = {
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
    allow_origin: STREAM_ALLOW_ORIGIN
  },
  http: {
    port: HTTP_PORT,
    allow_origin: STREAM_ALLOW_ORIGIN,
    mediaroot: MEDIA_ROOT,
  },
  trans: {
    ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
    tasks: [
      {
        app: "live",
        hls: true,
        hlsFlags: "[hls_time=2:hls_list_size=3:hls_flags=delete_segments]",
        hlsKeep: false, // Delete old segments
      }
    ]
  },
  auth: {
    // API for stream management
    api: true,
    api_user: API_USER,
    api_pass: API_PASS,
  },
  // Custom config for our app
  custom: {
    streamSecret: STREAM_SECRET,
    hlsRoot: HLS_ROOT,
  }
};

export default config;





