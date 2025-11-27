# POL Pump 🚀

**A Next-Generation Memecoin Trading Platform on Polygon Amoy - Market Ready**

POL Pump is a revolutionary decentralized trading platform that allows users to create, trade, and game with custom memetokens on the Polygon Amoy testnet. Built with cutting-edge Web3 technology, POL Pump combines instant token creation, bonding curve trading, and immersive gaming experiences.

![POL Pump](https://img.shields.io/badge/POL-Pump-purple?style=for-the-badge)
![Polygon](https://img.shields.io/badge/Polygon-Amoy-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=for-the-badge)
![Market Ready](https://img.shields.io/badge/Market-Ready-green?style=for-the-badge)

## ✨ Features

### 🎯 Token Creation
- **One-Click Token Creation**: Deploy custom memetokens with images and metadata in seconds
- **Automatic Liquidity**: Bonding curve AMM automatically seeds liquidity for immediate trading
- **Multiple Curve Types**: Choose from LINEAR, EXPONENTIAL, or SIGMOID bonding curves
- **Configurable Parameters**: Fine-tune curve parameters for custom pricing models
- **No Manual Setup**: No need to manually create liquidity pools or configure trading pairs

### 💱 Trading
- **Instant Trading**: Trade tokens immediately after creation via bonding curve AMM
- **Real-Time Price Updates**: Dynamic pricing based on configurable curve formulas
- **Fee Splitting**: Configurable fees split across platform, creator, burn, and LP reserve
- **Slippage Protection**: Built-in protection mechanisms for safe trading
- **Price Impact Calculation**: Real-time price impact estimates before trading

### 🎮 Gaming Integration
- **PumpPlay**: Battle-based gaming with token staking
- **Meme Royale**: Tournament-style competition
- **Mines**: Risk-reward gaming mechanics
- **Coinflip**: Simple yet engaging coin flip games
- **Real-Time Balance Updates**: All games integrate seamlessly with your token holdings

### 🤖 AI-Powered Features
- **AI Token Suggestions**: Get intelligent recommendations based on market trends
- **PumpAI Chat**: Ask questions about tokens, trading strategies, and platform features
- **Market Analysis**: AI-driven insights for better trading decisions

### 🏆 XP System & Quests
- **Experience Points**: Earn XP for trading, creating tokens, and daily activity
- **Level System**: Progressive leveling with exponential XP requirements
- **Quests**: Complete quests to earn bonus XP and rewards
- **Leaderboards**: Compete with other traders on various metrics

### 🔐 Security & Trust
- **Access Control**: Role-based access control with OpenZeppelin AccessControl
- **Reentrancy Protection**: All state-changing functions protected with ReentrancyGuard
- **Pausable Contracts**: Emergency pause functionality for security
- **Comprehensive Events**: All state changes emit events for transparency
- **Smart Contract Verified**: All contracts are open-source and auditable
- **Wallet Integration**: Secure connection via RainbowKit (MetaMask, WalletConnect, etc.)
- **Non-Custodial**: You maintain full control of your assets

### 📊 Professional Dashboard
- **Global Statistics**: Real-time platform metrics and KPIs
- **Token Discovery**: Advanced search and filtering
- **Token Detail Pages**: Comprehensive token information with charts
- **Trading Interface**: Intuitive buy/sell interface with price previews
- **User Profiles**: Track your XP, level, and trading statistics

## 🏗️ Architecture

### Frontend
- **Next.js 14** (App Router): Modern React framework with server-side rendering
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling with custom funky neon theme
- **Framer Motion**: Smooth animations and transitions
- **Wagmi v2**: React Hooks for Ethereum
- **RainbowKit**: Beautiful wallet connection UI

### Smart Contracts
- **EnhancedFactory**: Deploys new tokens and bonding curves with access control
- **EnhancedBondingCurve**: Configurable AMM bonding curve with multiple curve types
- **MemeToken**: ERC20-compatible token standard
- **Access Control**: Role-based permissions (Admin, Game Admin, Token Creator, Curve Manager)
- **Fee Splitting**: Configurable fee distribution (platform, creator, burn, LP)

### Backend
- **Indexer Service**: Event listener that indexes blockchain data to PostgreSQL
- **API Server**: RESTful API for frontend data queries
- **PostgreSQL**: Relational database for tokens, trades, users, and events
- **Next.js API Routes**: Serverless API endpoints

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and npm
- PostgreSQL 14+ (for indexer and API)
- A Web3 wallet (MetaMask recommended)
- Polygon Amoy testnet configured in your wallet

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pol2/0gPump
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Set up PostgreSQL**
   ```bash
   # Create database
   createdb polpump
   
   # Or using psql
   psql -U postgres -c "CREATE DATABASE polpump;"
   ```

4. **Configure environment variables**
   
   Create `.env.local` for frontend:
   ```env
   NEXT_PUBLIC_FACTORY_ADDRESS=0x...
   NEXT_PUBLIC_EVM_RPC=https://polygon-amoy.infura.io/v3/your_key
   NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
   ```

   Create `.env` for backend/indexer:
   ```env
   PORT=4000
   RPC_URL=https://polygon-amoy.infura.io/v3/your_key
   FACTORY_ADDRESS=0x...
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=polpump
   DB_USER=postgres
   DB_PASSWORD=postgres
   ```

5. **Start the indexer** (in one terminal)
   ```bash
   cd server
   node indexer.js
   ```

6. **Start the API server** (in another terminal)
   ```bash
   cd server
   node api/index.js
   ```

7. **Run the development server** (in another terminal)
   ```bash
   npm run dev
   ```

8. **Start the streaming server** (optional, for live streaming feature)
   ```bash
   npm run dev:stream
   ```
   
   Or run everything together:
   ```bash
   npm run dev:all
   ```

9. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Deploy Contracts (Optional)

If you want to deploy your own contracts:

```bash
# Compile contracts
npx hardhat compile

# Deploy to Polygon Amoy
node scripts/deployAllContractsPolygonAmoy.js
```

## 📖 Documentation

- **[Architecture Documentation](./docs/ARCHITECTURE.md)**: Detailed system architecture
- **[API Documentation](./docs/API.md)**: Complete API reference
- **[Smart Contract Specs](./contracts/)**: Contract source code with NatSpec comments

### Creating Your First Token

1. **Connect Your Wallet**: Click "Connect Wallet" and approve the connection
2. **Click "Create Coin"**: Open the token creation modal
3. **Fill in Details**:
   - Token Name (e.g., "DogeCoin")
   - Token Symbol (e.g., "DOGE")
   - Upload Image
   - Add Description
   - Choose Curve Type (Linear, Exponential, or Sigmoid)
   - Add Social Links (optional)
4. **Deploy**: Click "Create Token" and approve the transaction
5. **Start Trading**: Your token is immediately tradable!

### Trading Tokens

1. **Browse Tokens**: View all available tokens on the explore page
2. **Select a Token**: Click on any token card
3. **Buy or Sell**:
   - Enter amount (MATIC for buying, tokens for selling)
   - Review price impact and fees
   - Set slippage tolerance
   - Approve transaction (if needed)
   - Confirm trade
4. **Monitor**: Watch your portfolio update in real-time

### Gaming

1. **Navigate to Gaming**: Click "Gaming" in the sidebar
2. **Select a Game**: Choose from PumpPlay, Meme Royale, Mines, or Coinflip
3. **Select Token**: Choose which token to use
4. **Place Your Bet**: Enter amount and confirm
5. **Win Big**: Collect your winnings!

### 🎥 Live Streaming

POL Pump includes a complete live streaming system for token creators to engage with their community.

#### Setup

1. **Install FFmpeg** (required for streaming server):
   - **macOS**: `brew install ffmpeg`
   - **Windows**: Download from https://ffmpeg.org/download.html
   - **Linux**: `sudo apt-get install ffmpeg` or `sudo yum install ffmpeg`

2. **Start the streaming server**:
   ```bash
   cd streaming
   npm install
   npm run dev
   ```
   
   The streaming server will run on:
   - **RTMP Ingest**: `rtmp://localhost:1935/live` (for OBS)
   - **HLS Playback**: `http://localhost:8000/live/STREAM_KEY/index.m3u8` (for viewers)

3. **Configure environment variables** (in `.env.local`):
   ```env
   RTMP_URL=rtmp://localhost:1935/live
   NEXT_PUBLIC_HLS_BASE_URL=http://localhost:8000/live
   ```

4. **Start all services**:
   ```bash
   # Terminal 1: Streaming server
   npm run dev:stream
   
   # Terminal 2: Next.js app
   npm run dev
   
   # Or run everything together:
   npm run dev:all
   ```

#### For Creators (Starting a Stream)

1. **Create or own a token** in the app
2. **Navigate to your token's detail page**
3. **Click "Start Live Stream"** (only visible to token creator)
4. **Copy the RTMP Server and Stream Key** shown in the UI
5. **Open OBS Studio**:
   - Go to **Settings → Stream**
   - Service: **Custom**
   - Server: Paste the RTMP Server (e.g., `rtmp://localhost:1935/live`)
   - Stream Key: Paste the Stream Key
6. **Click "Start Streaming"** in OBS
7. **Viewers will see your stream** on the token page automatically

#### For Viewers

- Simply visit any token's detail page
- If the creator is live, the stream will automatically appear
- The stream uses HLS playback for smooth viewing across all browsers

#### Architecture

- **Streaming Server**: Node.js + Node-Media-Server (RTMP ingest + HLS transcoding)
- **Frontend Player**: hls.js for cross-browser HLS playback
- **Stream Validation**: Stream keys are validated against the database
- **Auto-Discovery**: Streams automatically appear when creators go live

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Animations** | Framer Motion |
| **Blockchain** | Ethers.js v6 |
| **Wallet** | Wagmi v2, RainbowKit |
| **Smart Contracts** | Solidity 0.8.24 |
| **Database** | PostgreSQL |
| **Indexer** | Node.js, ethers.js |
| **API** | Express.js |
| **Network** | Polygon Amoy Testnet |
| **Security** | OpenZeppelin Contracts |

## 🔒 Security Features

### Smart Contract Security
- ✅ Access Control with roles
- ✅ Reentrancy protection
- ✅ Pausable functionality
- ✅ Comprehensive input validation
- ✅ Safe math operations
- ✅ Deadline checks
- ✅ Slippage protection
- ✅ Emergency withdraw functions

### Testing
- ✅ Unit tests for contracts
- ✅ Integration tests
- ✅ Event coverage
- ✅ Gas optimization
- ✅ Security audit checklist

## 📁 Project Structure

```
0gPump/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── components/         # React components
│   ├── explore/            # Token discovery page
│   ├── token/              # Token detail pages
│   ├── gaming/             # Gaming section
│   ├── profile/            # User profiles
│   └── page.tsx            # Main dashboard
├── contracts/              # Solidity smart contracts
│   ├── EnhancedFactory.sol      # Enhanced factory with access control
│   ├── EnhancedBondingCurve.sol # Configurable bonding curve
│   ├── MemeToken.sol       # Token standard
│   └── DEX/                # UniswapV2 fork
├── lib/                    # Utility libraries
│   ├── newFactoryService.ts      # Factory interactions
│   ├── newBondingCurveTradingService.ts  # Trading logic
│   ├── xpSystem.ts         # XP and quest system
│   ├── contract-config.ts  # Contract addresses
│   └── rpc-config.ts      # RPC configuration
├── server/                  # Backend services
│   ├── indexer.js         # Blockchain event indexer
│   └── api/               # API server
├── test/                   # Test files
│   └── EnhancedFactory.test.js
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md    # System architecture
│   └── API.md             # API documentation
├── scripts/                # Deployment scripts
└── .github/workflows/      # CI/CD pipelines
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PRIVATE_KEY` | Deployer private key | `0x...` |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Factory contract address | `0x0Bd7...` |
| `NEXT_PUBLIC_EVM_RPC` | Polygon Amoy RPC URL | `https://polygon-amoy.infura.io/v3/...` |
| `NEXT_PUBLIC_BACKEND_URL` | Backend server URL | `http://localhost:4000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_NAME` | Database name | `polpump` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |

### Contract Addresses

All deployed contracts on Polygon Amoy:

- **Factory**: `0x0Bd71a034D5602014206B965677E83C6484561F2`
- **WETH9**: `0x0D94Dec8cE5792A86E4b95aF2E516c0A70042Aa1`
- **UniswapV2Factory**: `0x1Aa3fCC63f08103b20d8F34BaD6aE59dc6B10e45`
- **UniswapV2Router02**: `0xcC33bc5336A2D99515A916A52664ecdb761e79c5`
- **AutoTradingFactory**: `0xA01CD368F39956ce09e538ed731D685b60Ea68eb`

View on [PolygonScan Amoy](https://amoy.polygonscan.com/)

## 🧪 Testing

```bash
# Run contract tests
npx hardhat test

# Run frontend tests (if configured)
npm run test

# Run linting
npm run lint

# Check formatting
npx prettier --check "**/*.{ts,tsx,js,jsx}"
```

## 🚀 CI/CD

The project includes GitHub Actions workflows for:

- ✅ Linting and formatting checks
- ✅ Contract compilation and tests
- ✅ Frontend build verification
- ✅ Security audits
- ✅ Automated deployment to staging

See `.github/workflows/ci.yml` for details.

## 📈 Performance & Scaling

- **Caching**: Redis caching for heavy endpoints (to be implemented)
- **Pagination**: All list endpoints support pagination
- **Indexing**: Database indexes on frequently queried fields
- **Materialized Views**: For leaderboards and statistics
- **Load Balancing**: API server can be horizontally scaled

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Maintain code consistency
- Run linting before committing

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Polygon**: For the amazing testnet infrastructure
- **Uniswap**: For the DEX architecture inspiration
- **RainbowKit**: For beautiful wallet connection UI
- **Next.js Team**: For the incredible framework
- **OpenZeppelin**: For secure smart contract libraries

## 📞 Support

- **GitHub Issues**: [Report a bug](https://github.com/your-repo/issues)
- **Documentation**: Check the `docs/` folder for detailed documentation
- **Community**: Join our Discord (coming soon)

## 🚧 Roadmap

### Completed ✅
- [x] Enhanced contracts with access control
- [x] Multiple bonding curve types
- [x] Fee splitting logic
- [x] Comprehensive events
- [x] Indexer service
- [x] API endpoints
- [x] Professional dashboard
- [x] Token discovery page
- [x] XP system and quests
- [x] CI/CD pipeline
- [x] Documentation

### In Progress 🚧
- [ ] Mainnet deployment on Polygon
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Cross-chain bridge integration
- [ ] NFT minting for special tokens
- [ ] DAO governance
- [ ] More game modes
- [ ] Social trading features
- [ ] The Graph subgraph

## ⚠️ Disclaimer

This project is deployed on **Polygon Amoy Testnet** for testing purposes. Do not use real funds on testnet. Always verify contract addresses and test thoroughly before using on mainnet.

---

**Built with ❤️ for the Polygon ecosystem**

Made by [Your Name](https://github.com/your-username)
