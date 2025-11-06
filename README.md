# POL Pump 🚀

**A Next-Generation Memecoin Trading Platform on Polygon Amoy**

POL Pump is a revolutionary decentralized trading platform that allows users to create, trade, and game with custom memetokens on the Polygon Amoy testnet. Built with cutting-edge Web3 technology, POL Pump combines instant token creation, bonding curve trading, and immersive gaming experiences.

![POL Pump](https://img.shields.io/badge/POL-Pump-purple?style=for-the-badge)
![Polygon](https://img.shields.io/badge/Polygon-Amoy-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=for-the-badge)

## ✨ Features

### 🎯 Token Creation
- **One-Click Token Creation**: Deploy custom memetokens with images and metadata in seconds
- **Automatic Liquidity**: Bonding curve AMM automatically seeds liquidity for immediate trading
- **No Manual Setup**: No need to manually create liquidity pools or configure trading pairs

### 💱 Trading
- **Instant Trading**: Trade tokens immediately after creation via bonding curve AMM
- **Real-Time Price Updates**: Dynamic pricing based on constant-product formula (x * y = k)
- **Low Fees**: 0.5% trading fee on all transactions
- **Slippage Protection**: Built-in protection mechanisms for safe trading

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

### 🔐 Security & Trust
- **Polygon Amoy Testnet**: Deployed on Polygon's official testnet
- **Smart Contract Verified**: All contracts are open-source and auditable
- **Wallet Integration**: Secure connection via RainbowKit (MetaMask, WalletConnect, etc.)
- **Non-Custodial**: You maintain full control of your assets

## 🏗️ Architecture

### Frontend
- **Next.js 14** (App Router): Modern React framework with server-side rendering
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling with custom funky neon theme
- **Framer Motion**: Smooth animations and transitions
- **Wagmi v2**: React Hooks for Ethereum
- **RainbowKit**: Beautiful wallet connection UI

### Smart Contracts
- **Factory Contract**: Deploys new tokens and bonding curves
- **BondingCurve AMM**: Constant-product bonding curve for instant liquidity
- **MemeToken**: ERC20-compatible token standard
- **UniswapV2 Fork**: DEX integration for advanced trading

### Backend
- **Next.js API Routes**: Serverless API endpoints
- **SQLite**: Local database for coin metadata
- **Image Proxy**: Efficient image serving with caching

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- A Web3 wallet (MetaMask recommended)
- Polygon Amoy testnet configured in your wallet

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Anu062004/polPUMP.git
   cd polPUMP
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   PRIVATE_KEY=your_private_key_here
   NEXT_PUBLIC_FACTORY_ADDRESS=0x...
   NEXT_PUBLIC_EVM_RPC=https://polygon-amoy.infura.io/v3/your_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
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

### Creating Your First Token

1. **Connect Your Wallet**: Click "Connect Wallet" and approve the connection
2. **Click "Create Coin"**: Open the token creation modal
3. **Fill in Details**:
   - Token Name (e.g., "DogeCoin")
   - Token Symbol (e.g., "DOGE")
   - Upload Image
   - Add Description
   - Add Social Links (optional)
4. **Deploy**: Click "Create Token" and approve the transaction
5. **Start Trading**: Your token is immediately tradable!

### Trading Tokens

1. **Browse Tokens**: View all available tokens on the main page
2. **Select a Token**: Click on any token card
3. **Buy or Sell**:
   - Enter amount (MATIC for buying, tokens for selling)
   - Review price impact and fees
   - Approve transaction (if needed)
   - Confirm trade
4. **Monitor**: Watch your portfolio update in real-time

### Gaming

1. **Navigate to Gaming**: Click "Gaming" in the sidebar
2. **Select a Game**: Choose from PumpPlay, Meme Royale, Mines, or Coinflip
3. **Select Token**: Choose which token to use
4. **Place Your Bet**: Enter amount and confirm
5. **Win Big**: Collect your winnings!

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
| **Database** | SQLite |
| **Network** | Polygon Amoy Testnet |
| **RPC** | Infura |

## 📁 Project Structure

```
polPUMP/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── components/         # React components
│   ├── gaming/             # Gaming section
│   ├── profile/            # User profiles
│   └── page.tsx            # Main dashboard
├── contracts/              # Solidity smart contracts
│   ├── Factory.sol         # Token factory
│   ├── BondingCurve.sol    # AMM bonding curve
│   ├── MemeToken.sol       # Token standard
│   └── DEX/                # UniswapV2 fork
├── lib/                    # Utility libraries
│   ├── newFactoryService.ts      # Factory interactions
│   ├── newBondingCurveTradingService.ts  # Trading logic
│   ├── contract-config.ts  # Contract addresses
│   └── rpc-config.ts      # RPC configuration
├── scripts/                # Deployment scripts
│   └── deployAllContractsPolygonAmoy.js
├── public/                 # Static assets
└── data/                   # Local database
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PRIVATE_KEY` | Deployer private key | `0x...` |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Factory contract address | `0x0Bd7...` |
| `NEXT_PUBLIC_EVM_RPC` | Polygon Amoy RPC URL | `https://polygon-amoy.infura.io/v3/...` |
| `NEXT_PUBLIC_BACKEND_URL` | Backend server URL (optional) | `http://localhost:4000` |

### Contract Addresses

All deployed contracts on Polygon Amoy:

- **Factory**: `0x0Bd71a034D5602014206B965677E83C6484561F2`
- **WETH9**: `0x0D94Dec8cE5792A86E4b95aF2E516c0A70042Aa1`
- **UniswapV2Factory**: `0x1Aa3fCC63f08103b20d8F34BaD6aE59dc6B10e45`
- **UniswapV2Router02**: `0xcC33bc5336A2D99515A916A52664ecdb761e79c5`
- **AutoTradingFactory**: `0xA01CD368F39956ce09e538ed731D685b60Ea68eb`

View on [PolygonScan Amoy](https://amoy.polygonscan.com/)

## 🎨 Design

POL Pump features a **funky neon cyberpunk aesthetic** with:
- Vibrant purple, pink, and cyan gradients
- Animated neon glows and shadows
- Smooth transitions and hover effects
- Glassmorphism cards with backdrop blur
- Responsive design for all devices

## 🧪 Testing

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Polygon**: For the amazing testnet infrastructure
- **Uniswap**: For the DEX architecture inspiration
- **RainbowKit**: For beautiful wallet connection UI
- **Next.js Team**: For the incredible framework

## 📞 Support

- **GitHub Issues**: [Report a bug](https://github.com/Anu062004/polPUMP/issues)
- **Documentation**: Check the code comments for detailed explanations
- **Community**: Join our Discord (coming soon)

## 🚧 Roadmap

- [ ] Mainnet deployment on Polygon
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Cross-chain bridge integration
- [ ] NFT minting for special tokens
- [ ] DAO governance
- [ ] More game modes
- [ ] Social trading features

## ⚠️ Disclaimer

This project is deployed on **Polygon Amoy Testnet** for testing purposes. Do not use real funds on testnet. Always verify contract addresses and test thoroughly before using on mainnet.

---

**Built with ❤️ for the Polygon ecosystem**

Made by [Anu062004](https://github.com/Anu062004)

