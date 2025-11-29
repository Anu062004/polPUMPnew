# polPUMP Streaming Server

RTMP/HLS streaming server using Node-Media-Server for live streaming functionality.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install FFmpeg:**
   - **macOS:** `brew install ffmpeg`
   - **Windows:** Download from https://ffmpeg.org/download.html
   - **Linux:** `sudo apt-get install ffmpeg` or `sudo yum install ffmpeg`

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

## Usage

### For Streamers (OBS Setup)

1. Open OBS Studio
2. Go to **Settings → Stream**
3. Set:
   - **Service:** Custom
   - **Server:** `rtmp://localhost:1935/live`
   - **Stream Key:** Get this from the coin page after clicking "Start Live Stream"

4. Click **Start Streaming** in OBS

### For Viewers

The stream will automatically appear on the coin's detail page when live.

HLS playback URL format: `http://localhost:8000/live/STREAM_KEY/index.m3u8`

## Architecture

- **RTMP Ingest:** Port 1935 (for OBS/streaming clients)
- **HLS Playback:** Port 8000 (for web viewers)
- **Stream Validation:** Validates stream keys via main app API
- **Media Storage:** `./media/hls/` (HLS segments)

## Stream Key Format

Stream keys follow the format: `tokenAddress-randomSecret`

Example: `0x1234567890abcdef1234567890abcdef12345678-abc123def456`

The server validates these keys by checking with the main app's database.

## Development

- **Watch mode:** `npm run dev` (auto-restarts on changes)
- **Production:** `npm run build && npm run start:prod`

## Troubleshooting

1. **FFmpeg not found:** Ensure FFmpeg is installed and in your PATH
2. **Port already in use:** Change `RTMP_PORT` or `HTTP_PORT` in `.env`
3. **Stream rejected:** Check that stream key is valid and stream is marked as "live" in database
4. **HLS not playing:** Check browser console for CORS errors, ensure `allow_origin: "*"` in config



