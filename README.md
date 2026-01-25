<div align="center">

![POLpump Rocket](./polpump-rocket.png)

# POLpump 🚀

**A Next-Generation Memecoin Trading Platform on Polygon Mainnet**

[![Polygon](https://img.shields.io/badge/Polygon-Mainnet-8247E5?style=for-the-badge&logo=polygon)](https://polygonscan.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Production-Ready • Fully Deployed • Verified Contracts**

[Features](#-features) • [Quick Start](#-quick-start) • [Smart Contracts](#-smart-contracts) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## 🌟 Overview

**POLpump** is a revolutionary decentralized trading platform that enables users to create, trade, and interact with custom memetokens on Polygon Mainnet. Built with cutting-edge Web3 technology, POLpump combines instant token creation, bonding curve trading, AI-powered features, gaming mechanics, and live streaming capabilities into a single, powerful platform.

### 🎯 **Core Capabilities**

- **⚡ Instant Token Creation**: Deploy custom memetokens with images and metadata in seconds
- **📈 Bonding Curve Trading**: Automated market making with multiple curve types (Linear, Exponential, Sigmoid)
- **🤖 AI-Powered Features**: Intelligent token suggestions and market analysis
- **🎮 Gaming Integration**: Battle-based games, tournaments, and risk-reward mechanics
- **📺 Live Streaming**: Token creators can stream to their communities
- **🔐 Role-Based Access**: Token-gated permissions for creators and traders
- **💱 DEX Integration**: Full UniswapV2-compatible decentralized exchange

---

## ✨ Features

### 🎯 Token Creation & Management

- **One-Click Deployment**: Create tokens with custom names, symbols, images, and metadata
- **Multiple Factory Options**: Choose from Standard, Enhanced, or PumpFun-style factories
- **Automatic Liquidity**: Bonding curve AMM automatically seeds liquidity for immediate trading
- **Configurable Curves**: Linear, Exponential, or Sigmoid bonding curves with custom parameters
- **Fee Splitting**: Configurable fees split across platform, creator, burn, and LP reserve
- **No Manual Setup**: No need to manually create liquidity pools or configure trading pairs

### 💱 Trading & DEX

- **Instant Trading**: Trade tokens immediately after creation via bonding curve AMM
- **Real-Time Price Updates**: Dynamic pricing based on configurable curve formulas
- **Slippage Protection**: Built-in protection mechanisms for safe trading
- **Price Impact Calculation**: Real-time price impact estimates before trading
- **UniswapV2 Compatible**: Full DEX integration with router and factory contracts
- **Wrapped MATIC Support**: Native WETH/WMATIC integration for seamless trading

### 🎮 Gaming Ecosystem

- **PumpPlay**: Battle-based gaming with token staking
- **Meme Royale**: Tournament-style competition
- **Mines**: Risk-reward gaming mechanics
- **Coinflip**: Simple yet engaging coin flip games
- **Real-Time Balance Updates**: All games integrate seamlessly with your token holdings
- **Game Bank & Registry**: Secure gaming contracts with proper fund management

### 🤖 AI-Powered Features

- **AI Token Suggestions**: Get intelligent recommendations based on market trends
- **PumpAI Chat**: Ask questions about tokens, trading strategies, and platform features
- **Market Analysis**: AI-driven insights for better trading decisions

### 🏆 XP System & Quests

- **Experience Points**: Earn XP for trading, creating tokens, and daily activity
- **Level System**: Progressive leveling with exponential XP requirements
- **Quests**: Complete quests to earn bonus XP and rewards
- **Leaderboards**: Compete with other traders on various metrics

### 🎥 Live Streaming

- **Creator Streams**: Token creators can stream to their communities
- **WebRTC Integration**: High-quality streaming with HLS playback
- **Real-Time Chat**: Engage with viewers during live streams
- **Stream Validation**: Secure stream keys validated against the database

### 🔐 Security & Trust

- **Access Control**: Role-based access control with OpenZeppelin AccessControl
- **Reentrancy Protection**: All state-changing functions protected with ReentrancyGuard
- **Pausable Contracts**: Emergency pause functionality for security
- **Comprehensive Events**: All state changes emit events for transparency
- **Verified Contracts**: All contracts are verified on PolygonScan and open-source
- **Wallet Integration**: Secure connection via RainbowKit (MetaMask, WalletConnect, etc.)
- **Non-Custodial**: You maintain full control of your assets

### 📊 Professional Dashboard

- **Global Statistics**: Real-time platform metrics and KPIs
- **Token Discovery**: Advanced search and filtering
- **Token Detail Pages**: Comprehensive token information with charts
- **Trading Interface**: Intuitive buy/sell interface with price previews
- **User Profiles**: Track your XP, level, and trading statistics

---

## 🏗️ Architecture

### Frontend Stack

- **Next.js 14** (App Router): Modern React framework with server-side rendering
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling with custom theme
- **Framer Motion**: Smooth animations and transitions
- **Wagmi v2**: React Hooks for Ethereum
- **RainbowKit**: Beautiful wallet connection UI
- **Recharts**: Data visualization and charts

### Smart Contracts

- **Solidity 0.8.24**: Latest stable compiler with `viaIR` optimization
- **OpenZeppelin**: Battle-tested security libraries
- **Multiple Factories**: Standard, Enhanced, PumpFun, and AutoTrading factories
- **Bonding Curves**: Configurable AMM with multiple curve types
- **DEX Integration**: Full UniswapV2-compatible DEX
- **Gaming Contracts**: Secure game bank and registry
- **Marketplace**: Token marketplace for secondary trading

### Backend Services

- **Indexer Service**: Event listener that indexes blockchain data to PostgreSQL
- **API Server**: RESTful API for frontend data queries
- **PostgreSQL**: Relational database for tokens, trades, users, and events
- **Next.js API Routes**: Serverless API endpoints
- **Socket.IO**: Real-time chat and streaming support

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and npm 9+
- **PostgreSQL** 14+ (for indexer and API)
- **Web3 Wallet** (MetaMask recommended)
- **Polygon Mainnet** configured in your wallet
- **MATIC** for gas fees

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
   # Network Configuration
   NEXT_PUBLIC_NETWORK=polygon
   NEXT_PUBLIC_CHAIN_ID=137
   NEXT_PUBLIC_EVM_RPC=https://polygon-mainnet.infura.io/v3/your_key
   
   # Contract Addresses (see Smart Contracts section below)
   NEXT_PUBLIC_FACTORY_ADDRESS=0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69
   NEXT_PUBLIC_ENHANCED_FACTORY_ADDRESS=0x2Bb6c5118CB65C5E8cA774fCE59cd08024E9ad76
   NEXT_PUBLIC_PUMPFUN_FACTORY_ADDRESS=0xa214AE0b2C9A3062208c82faCA879e766558dc15
   NEXT_PUBLIC_AUTO_TRADING_FACTORY_ADDRESS=0x46B7ae01b3e53ad77Df82867d24a87610B0780b4
   NEXT_PUBLIC_WETH_ADDRESS=0xFd84545E34762943E29Ab17f98815280c4a90Cb6
   NEXT_PUBLIC_UNISWAP_FACTORY_ADDRESS=0x297dcec928893bf73C8b9c22dB3Efa2143E0dE53
   NEXT_PUBLIC_ROUTER_ADDRESS=0xE23469d5aFb586B8c45D669958Ced489ee9Afb09
   NEXT_PUBLIC_GAME_BANK_ADDRESS=0xDeAdB867DA927d7b8e7CF2FF6105571DD4B5be1a
   NEXT_PUBLIC_GAME_REGISTRY_ADDRESS=0xDbBA4f5A4b1D9aE51E533E3C212898169df69EAc
   NEXT_PUBLIC_TOKEN_MARKETPLACE_ADDRESS=0xed401473e938714927392182ea5c8F65593946d8
   
   # Services
   NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
   ```

   Create `.env` for backend/indexer:
   ```env
   PORT=4000
   RPC_URL=https://polygon-mainnet.infura.io/v3/your_key
   FACTORY_ADDRESS=0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=polpump
   DB_USER=postgres
   DB_PASSWORD=postgres
   JWT_SECRET=your-secret-key-change-in-production
   ```

5. **Start the development servers**

   ```bash
   # Start all services together
   npm run dev:all
   ```

   Or start individually:
   ```bash
   # Terminal 1: Next.js frontend
   npm run dev
   
   # Terminal 2: API server
   npm run dev:api
   
   # Terminal 3: Indexer service
   npm run dev:indexer
   
   # Terminal 4: Streaming server (optional)
   npm run dev:stream
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 📋 Smart Contracts

All contracts are deployed and verified on **Polygon Mainnet** (Chain ID: 137).

### Factory Contracts

| Contract | Address | PolygonScan |
|----------|---------|-------------|
| **Factory** | `0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69` | [View on PolygonScan](https://polygonscan.com/address/0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69) |
| **Enhanced Factory** | `0x2Bb6c5118CB65C5E8cA774fCE59cd08024E9ad76` | [View on PolygonScan](https://polygonscan.com/address/0x2Bb6c5118CB65C5E8cA774fCE59cd08024E9ad76) |
| **PumpFun Factory** | `0xa214AE0b2C9A3062208c82faCA879e766558dc15` | [View on PolygonScan](https://polygonscan.com/address/0xa214AE0b2C9A3062208c82faCA879e766558dc15) |
| **Auto Trading Factory** | `0x46B7ae01b3e53ad77Df82867d24a87610B0780b4` | [View on PolygonScan](https://polygonscan.com/address/0x46B7ae01b3e53ad77Df82867d24a87610B0780b4) |

### DEX Contracts (UniswapV2 Fork)

| Contract | Address | PolygonScan |
|----------|---------|-------------|
| **Wrapped MATIC (WETH)** | `0xFd84545E34762943E29Ab17f98815280c4a90Cb6` | [View on PolygonScan](https://polygonscan.com/address/0xFd84545E34762943E29Ab17f98815280c4a90Cb6) |
| **UniswapV2 Factory** | `0x297dcec928893bf73C8b9c22dB3Efa2143E0dE53` | [View on PolygonScan](https://polygonscan.com/address/0x297dcec928893bf73C8b9c22dB3Efa2143E0dE53) |
| **UniswapV2 Router** | `0xE23469d5aFb586B8c45D669958Ced489ee9Afb09` | [View on PolygonScan](https://polygonscan.com/address/0xE23469d5aFb586B8c45D669958Ced489ee9Afb09) |

### Gaming Contracts

| Contract | Address | PolygonScan |
|----------|---------|-------------|
| **Game Bank** | `0xDeAdB867DA927d7b8e7CF2FF6105571DD4B5be1a` | [View on PolygonScan](https://polygonscan.com/address/0xDeAdB867DA927d7b8e7CF2FF6105571DD4B5be1a) |
| **Game Registry** | `0xDbBA4f5A4b1D9aE51E533E3C212898169df69EAc` | [View on PolygonScan](https://polygonscan.com/address/0xDbBA4f5A4b1D9aE51E533E3C212898169df69EAc) |

### Marketplace Contracts

| Contract | Address | PolygonScan |
|----------|---------|-------------|
| **Token Marketplace** | `0xed401473e938714927392182ea5c8F65593946d8` | [View on PolygonScan](https://polygonscan.com/address/0xed401473e938714927392182ea5c8F65593946d8) |

### Treasury

| Contract | Address | PolygonScan |
|----------|---------|-------------|
| **Treasury** | `0x1aB7d5eCBe2c551eBfFdfA06661B77cc60dbd425` | [View on PolygonScan](https://polygonscan.com/address/0x1aB7d5eCBe2c551eBfFdfA06661B77cc60dbd425) |

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5.4 |
| **Styling** | Tailwind CSS |
| **Animations** | Framer Motion |
| **Blockchain** | Ethers.js v6 |
| **Wallet** | Wagmi v2, RainbowKit |
| **Smart Contracts** | Solidity 0.8.24 |
| **Database** | PostgreSQL |
| **Indexer** | Node.js, ethers.js |
| **API** | Express.js |
| **Network** | Polygon Mainnet (Chain ID: 137) |
| **Security** | OpenZeppelin Contracts |
| **Streaming** | Node-Media-Server, HLS.js |

---

## 🔒 Security Features

### Smart Contract Security

- ✅ **Access Control**: Role-based permissions with OpenZeppelin AccessControl
- ✅ **Reentrancy Protection**: All state-changing functions protected with ReentrancyGuard
- ✅ **Pausable Functionality**: Emergency pause capability for security incidents
- ✅ **Input Validation**: Comprehensive validation of all user inputs
- ✅ **Safe Math Operations**: Overflow/underflow protection
- ✅ **Deadline Checks**: Time-based transaction validation
- ✅ **Slippage Protection**: Built-in slippage tolerance mechanisms
- ✅ **Emergency Withdraw**: Admin functions for emergency fund recovery

### Testing & Auditing

- ✅ Unit tests for contracts
- ✅ Integration tests
- ✅ Event coverage
- ✅ Gas optimization
- ✅ Security audit checklist
- ✅ All contracts verified on PolygonScan

---

## 📖 Usage Guide

### Creating Your First Token

1. **Connect Your Wallet**: Click "Connect Wallet" and approve the connection
2. **Navigate to Create**: Click "Create Coin" in the navigation
3. **Fill in Details**:
   - Token Name (e.g., "DogeCoin")
   - Token Symbol (e.g., "DOGE")
   - Upload Image
   - Add Description
   - Choose Curve Type (Linear, Exponential, or Sigmoid)
   - Configure Fee Split (optional)
   - Add Social Links (optional)
4. **Deploy**: Click "Create Token" and approve the transaction
5. **Start Trading**: Your token is immediately tradable!

### Trading Tokens

1. **Browse Tokens**: View all available tokens on the explore page
2. **Select a Token**: Click on any token card to view details
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
3. **Select Token**: Choose which token to use for the game
4. **Place Your Bet**: Enter amount and confirm
5. **Win Big**: Collect your winnings!

### Live Streaming

#### For Creators

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

---

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
│   ├── ai-chat/            # AI chat interface
│   ├── ai-suggestions/     # AI token suggestions
│   ├── livestreams/        # Live streaming pages
│   └── page.tsx            # Main dashboard
├── contracts/              # Solidity smart contracts
│   ├── Factory.sol         # Main factory contract
│   ├── EnhancedFactory.sol # Enhanced factory with access control
│   ├── EnhancedBondingCurve.sol # Configurable bonding curve
│   ├── PumpFunFactory.sol  # PumpFun-style factory
│   ├── AutoTradingFactory.sol # Auto trading factory
│   ├── MemeToken.sol       # Token standard
│   ├── DEX/                # UniswapV2 fork
│   ├── GameBank.sol        # Gaming bank contract
│   ├── GameRegistry.sol    # Game registry contract
│   └── TokenMarketplace.sol # Token marketplace
├── lib/                    # Utility libraries
│   ├── newFactoryService.ts      # Factory interactions
│   ├── newBondingCurveTradingService.ts  # Trading logic
│   ├── xpSystem.ts         # XP and quest system
│   ├── contract-config.ts  # Contract addresses
│   └── rpc-config.ts      # RPC configuration
├── server/                  # Backend services
│   ├── indexer.js         # Blockchain event indexer
│   └── api/               # API server
├── streaming/              # Streaming server
│   └── src/               # Streaming server source
├── test/                   # Test files
│   └── EnhancedFactory.test.js
├── scripts/                # Deployment scripts
│   ├── deployPolygonMainnet.js
│   └── verifyContracts.js
└── public/                 # Static assets
    └── pump-logo.jpg      # Logo image
```

---

## 🧪 Testing

```bash
# Run contract tests
npm run test:contracts

# Compile contracts
npm run compile:contracts

# Run linting
npm run lint

# Check formatting
npx prettier --check "**/*.{ts,tsx,js,jsx}"
```

---

## 🚀 Deployment

### Deploy Contracts

```bash
# Compile contracts
npx hardhat compile

# Deploy to Polygon Mainnet
npm run deploy:polygon

# Verify contracts on PolygonScan
npm run verify:polygon
```

### Deploy Frontend

```bash
# Build for production
npm run build

# Start production server
npm run start
```

Deploy to:
- **Vercel** (recommended for Next.js)
- **Netlify**
- **Custom VPS**

---

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

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- **Polygon**: For the amazing blockchain infrastructure
- **Uniswap**: For the DEX architecture inspiration
- **RainbowKit**: For beautiful wallet connection UI
- **Next.js Team**: For the incredible framework
- **OpenZeppelin**: For secure smart contract libraries

---

## 📞 Support

- **GitHub Issues**: [Report a bug or request a feature](https://github.com/your-repo/issues)
- **Documentation**: Check the `docs/` folder for detailed documentation
- **Community**: Join our Discord (coming soon)

---

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
- [x] Gaming integration
- [x] Live streaming
- [x] AI-powered features
- [x] **Mainnet deployment on Polygon**
- [x] **All contracts verified on PolygonScan**

### In Progress 🚧

- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Cross-chain bridge integration
- [ ] NFT minting for special tokens
- [ ] DAO governance
- [ ] More game modes
- [ ] Social trading features
- [ ] The Graph subgraph

---

<div align="center">

**Built with ❤️ by Anubhav for the Polygon ecosystem**

**POLpump** - Where memes meet DeFi 🚀

[View on PolygonScan](https://polygonscan.com/) • [Documentation](./docs/) • [Report Bug](https://github.com/your-repo/issues)

</div>
