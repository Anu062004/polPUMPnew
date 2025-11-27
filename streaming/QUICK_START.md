# Quick Start: Live Streaming Setup

## Prerequisites

1. **Install FFmpeg**:
   - macOS: `brew install ffmpeg`
   - Windows: Download from https://ffmpeg.org/download.html
   - Linux: `sudo apt-get install ffmpeg`

2. **Node.js 20+** (already installed for main app)

## Setup Steps

1. **Install dependencies**:
   ```bash
   cd streaming
   npm install
   ```

2. **Configure environment** (optional):
   ```bash
   cp .env.example .env
   # Edit .env if needed (defaults work for local development)
   ```

3. **Start the streaming server**:
   ```bash
   npm run dev
   ```

   You should see:
   ```
   ╔══════════════════════════════════════════════════════════╗
   ║     polPUMP Streaming Server Started                    ║
   ╠══════════════════════════════════════════════════════════╣
   ║  RTMP Ingest:  rtmp://localhost:1935/live          ║
   ║  HLS Playback: http://localhost:8000/live/STREAM_KEY/index.m3u8  ║
   ╚══════════════════════════════════════════════════════════╝
   ```

## Using Live Streaming

### For Token Creators

1. **Start the main app** (in another terminal):
   ```bash
   npm run dev
   ```

2. **Create or navigate to your token** in the app

3. **Click "Start Live Stream"** on the token detail page

4. **Copy the RTMP Server and Stream Key** from the UI

5. **Open OBS Studio**:
   - Settings → Stream
   - Service: **Custom**
   - Server: `rtmp://localhost:1935/live`
   - Stream Key: (paste from UI)
   - Click **OK**

6. **Start Streaming** in OBS

7. **Viewers will see your stream** on the token page automatically!

### For Viewers

- Simply visit any token's detail page
- If the creator is live, the stream appears automatically
- No setup required!

## Troubleshooting

### "FFmpeg not found"
- Ensure FFmpeg is installed and in your PATH
- Test with: `ffmpeg -version`

### "Port already in use"
- Change `RTMP_PORT` or `HTTP_PORT` in `.env`
- Or stop the process using those ports

### "Stream rejected"
- Check that stream key matches what's shown in the UI
- Ensure you clicked "Start Live Stream" in the app first
- Check streaming server logs for errors

### "Stream not playing"
- Wait 5-10 seconds after starting OBS (HLS needs time to initialize)
- Check browser console for errors
- Verify streaming server is running
- Ensure OBS is actually streaming (check OBS status)

### "CORS errors"
- The streaming server allows all origins by default
- If issues persist, check `allow_origin` in `src/config.ts`

## Production Deployment

For production, you'll want to:

1. **Set secure stream secret** in `.env`:
   ```
   STREAM_SECRET=your-very-secure-random-secret-here
   ```

2. **Configure proper CORS** in `src/config.ts`:
   ```typescript
   allow_origin: "https://yourdomain.com"
   ```

3. **Use environment variables** for URLs:
   ```
   RTMP_URL=rtmp://your-stream-server.com/live
   NEXT_PUBLIC_HLS_BASE_URL=https://your-stream-server.com/live
   ```

4. **Set up reverse proxy** (nginx) for HTTPS:
   - RTMP: `rtmp://your-server.com/live`
   - HLS: `https://your-server.com/live/...`

5. **Run as a service** (PM2, systemd, etc.)


