# POL Pump Gaming Backend Server

Dedicated backend server for all gaming endpoints expected by the frontend in `app/gaming/page.tsx`.

> **📋 Quick Start Guide**: See [DEV_NOTES.md](./DEV_NOTES.md) for step-by-step setup and debugging tips.

## Features

- **PumpPlay**: Round-based betting system with pool payouts
- **Meme Royale**: AI-judged coin battles
- **Coinflip**: Provably fair coin flipping game
- **Mines**: Progressive multiplier game with cashout

## Setup

### Prerequisites

- Node.js 20.x or higher
- npm or yarn

### Installation

```bash
cd server
npm install
```

### Running the Server

#### Development Mode (with auto-reload)

```bash
npm run dev
```

#### Production Mode

```bash
npm run build
npm start
```

The server will start on port 4000 by default (or the port specified in environment variables).

## Environment Variables

### Required Configuration

Create a `.env` file in the `server/` directory with the following variables:

```env
# Server Configuration
BACKEND_PORT=4000
FRONTEND_ORIGIN=http://localhost:3000

# Blockchain/RPC Configuration
RPC_URL=https://polygon-amoy.infura.io/v3/YOUR_KEY

# Optional: Enable/disable on-chain validation
ENABLE_ON_CHAIN_VALIDATION=true
```

### Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | `4000` | Server port (priority: BACKEND_PORT > PORT > 4000) |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS origin for production (dev defaults to localhost:3000) |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000` | Used by frontend - do not remove |
| `RPC_URL` | (see below) | Primary RPC URL for blockchain queries |
| `NEXT_PUBLIC_EVM_RPC` | (see below) | Alternative RPC URL (for compatibility) |
| `POLYGON_AMOY_RPC` | (see below) | Legacy RPC URL (for compatibility) |
| `ENABLE_ON_CHAIN_VALIDATION` | `true` | Enable/disable on-chain validation (set to 'false' to disable) |
| `NODE_ENV` | `development` | Node environment (`development` or `production`) |

**RPC URL Priority:**
1. `RPC_URL`
2. `NEXT_PUBLIC_EVM_RPC`
3. `POLYGON_AMOY_RPC`
4. Default: `https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f`

### Example .env File

```env
# Copy this to server/.env and update with your values

# Server
BACKEND_PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

# RPC (use your own endpoint for production)
RPC_URL=https://polygon-amoy.infura.io/v3/YOUR_KEY
# OR use alternative:
# NEXT_PUBLIC_EVM_RPC=https://polygon-amoy.infura.io/v3/YOUR_KEY

# Optional: Disable on-chain validation for faster responses (no balance checks)
# ENABLE_ON_CHAIN_VALIDATION=false

NODE_ENV=development
```

## Production Deployment

### Build and Start

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

### Production Environment Variables

For production, ensure these are set:

```env
NODE_ENV=production
BACKEND_PORT=4000
FRONTEND_ORIGIN=https://your-frontend-domain.com
RPC_URL=https://your-production-rpc-endpoint.com
ENABLE_ON_CHAIN_VALIDATION=true
```

### CORS Configuration

- **Development**: Automatically allows `http://localhost:3000`
- **Production**: Set `FRONTEND_ORIGIN` to your frontend domain
- Fallback: Uses `NEXT_PUBLIC_BACKEND_URL` if `FRONTEND_ORIGIN` is not set

### Process Management

For production, consider using a process manager like PM2:

```bash
npm install -g pm2
pm2 start dist/index.js --name polpump-gaming
pm2 save
pm2 startup
```

## Database

The server uses SQLite3 databases stored in the `data/` folder at the project root:

- `data/gaming.db` - Stores all gaming-related data (rounds, bets, battles, games)
- `data/coins.db` - Stores coin information (reused from main app)

### Database Management

- Tables are automatically created on first run (via `db.ts`)
- Schema migrations run on server start (currently no migrations needed)
- Database connections are cached and reused (singleton pattern)
- All database operations use centralized connection management

### Database Location

The database files are stored relative to the project root, not the server directory:
- Running from `server/`: `../data/gaming.db`
- Running from project root: `./data/gaming.db`

The server automatically detects the correct path.

## Architecture

### Module Structure

```
server/
├── index.ts              # Main server file (Express setup, route registration)
├── config.ts             # Centralized configuration (env vars, paths)
├── db.ts                 # Database connection management (singleton pattern)
├── blockchain.ts         # Blockchain utilities (read-only, non-blocking)
├── routes/
│   ├── pumpplay.ts      # PumpPlay endpoints
│   ├── meme-royale.ts   # Meme Royale endpoints
│   ├── coinflip.ts      # Coinflip endpoints
│   └── mines.ts         # Mines endpoints
├── types/
│   └── gaming.ts        # TypeScript types for all games
├── package.json
├── tsconfig.json
└── README.md
```

### Configuration Flow

1. **Environment Variables** → `config.ts` (centralized, validated)
2. **Database** → `db.ts` (singleton connections, auto-initialization)
3. **Blockchain** → `blockchain.ts` (read-only helpers, graceful degradation)
4. **Routes** → Use centralized modules via dependency injection

### On-Chain Integration

The backend provides **read-only** blockchain access:

- **Token Balance Checking**: Uses centralized `getTokenBalance()` helper
- **Address Validation**: Uses `validateTokenAddress()` helper
- **Block Randomness**: Uses `getLatestBlock()` for Coinflip provable fairness
- **Graceful Degradation**: If RPC fails, games continue with fallback logic

**Important:** The backend does NOT send transactions. All transactions are initiated by the frontend (user's wallet).

## API Endpoints

All endpoints are prefixed with `/gaming`:

### Health Check
- `GET /health` - Returns `{ status: "ok", databases: "connected", rpc: "connected|unavailable" }`

### Coins
- `GET /gaming/coins/:address` - Get all coins and user's token balances

### PumpPlay
- `GET /gaming/pumpplay/rounds` - Get all rounds (creates new round if none exist)
- `POST /gaming/pumpplay/bet` - Place a bet on a round

### Meme Royale
- `GET /gaming/meme-royale/battles` - Get recent battles
- `POST /gaming/meme-royale` - Start a new battle

### Coinflip
- `POST /gaming/coinflip` - Play a coinflip game
- `GET /gaming/coinflip/leaderboard` - Get leaderboard
- `GET /gaming/coinflip/recent` - Get recent games

### Mines
- `POST /gaming/mines/start` - Start a new mines game
- `POST /gaming/mines/reveal` - Reveal a tile
- `POST /gaming/mines/cashout` - Cash out current game

See `GAME_FLOWS.md` for detailed endpoint documentation.

## Development

### TypeScript

The server is written in TypeScript. To check types:

```bash
npm run type-check
```

### Database Schema

The server automatically creates the following tables on startup:

- `gaming_pumpplay_rounds` - Round information
- `gaming_pumpplay_bets` - Individual bets
- `gaming_meme_royale` - Battle records
- `gaming_coinflip` - Coinflip game results
- `gaming_mines` - Mines game sessions

See `db.ts` for the complete schema definitions.

### Error Handling

All endpoints follow consistent error response format:

```typescript
{
  success: false,
  error: "Human-readable error message"
}
```

HTTP Status Codes:
- `400` - Bad Request (validation errors, invalid input)
- `404` - Not Found (game/round doesn't exist)
- `500` - Internal Server Error (database errors, unexpected errors)

## Troubleshooting

### Database Not Found

If you see "database not found" errors:

1. Check that the `data/` folder exists at the project root
2. Ensure the server has write permissions to create the folder
3. Verify the database path in `config.ts` matches your setup

### RPC Connection Issues

If RPC connection fails:

1. Check `RPC_URL` environment variable is set correctly
2. Verify the RPC endpoint is accessible
3. Check `ENABLE_ON_CHAIN_VALIDATION` is set (default: true)
4. The server will continue to work without RPC (with reduced functionality)

### Port Already in Use

If port 4000 is already in use:

1. Set `BACKEND_PORT` environment variable to a different port
2. Update frontend `NEXT_PUBLIC_BACKEND_URL` to match

## Notes

- The server matches the exact API contract expected by `app/gaming/page.tsx`
- All endpoints have fallback to Next.js API routes if the backend is unavailable
- Database connections are cached and reused across requests (singleton pattern)
- All blockchain operations are read-only and non-blocking (graceful degradation)
- No private keys or secrets should be stored in code - use environment variables
