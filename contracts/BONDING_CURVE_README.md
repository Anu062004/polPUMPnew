# Pump.fun-Style Bonding Curve System

This directory contains the pump.fun-style bonding curve implementation for PolPump.

## Overview

The bonding curve system allows tokens to be bought and sold directly on the platform before migrating to a DEX. It uses a simple monotonic price curve where price increases with supply.

## Contracts

### BondingCurvePool.sol

The main bonding curve contract that handles buying and selling tokens.

**Key Features:**
- Linear or exponential price curves
- Mints tokens on buy, burns on sell
- Fee collection to treasury
- Can be closed when migrating to DEX
- Gas-efficient with SafeERC20

**Functions:**
- `buy(uint256 baseAmountIn, uint256 minTokensOut)` - Buy tokens with MATIC
- `sell(uint256 tokenAmountIn, uint256 minBaseOut)` - Sell tokens for MATIC
- `getPriceForBuy(uint256 tokenAmount)` - Preview cost for buying tokens
- `getPriceForSell(uint256 tokenAmount)` - Preview return for selling tokens
- `getCurveInfo()` - Get current price, liquidity, market cap, and status
- `closeCurve()` - Close the curve (owner only, when migrating to DEX)

**Events:**
- `Bought` - Emitted when tokens are bought
- `Sold` - Emitted when tokens are sold
- `CurveInitialized` - Emitted when curve is created
- `CurveClosed` - Emitted when curve is closed

### PumpFunFactory.sol

Factory contract that automatically creates a bonding curve pool for each new token.

**Functions:**
- `createToken(name, symbol, maxSupply)` - Create token with default curve parameters
- `createTokenWithParams(...)` - Create token with custom curve parameters
- `tokenToCurve(address)` - Get curve address for a token
- `curveToToken(address)` - Get token address for a curve

## Curve Math

### Linear Curve

Price formula: `price = basePrice + (soldSupply * priceIncrement)`

When buying `n` tokens starting from supply `s`:
```
baseCost = ∫[s to s+n] price(supply) d(supply)
         = basePrice * n + priceIncrement * (s * n + n²/2)
```

### Exponential Curve

Price formula: `price = basePrice * (1 + growthRate)^soldSupply`

Simplified approximation for gas efficiency:
```
price ≈ basePrice * (1 + growthRateBps/10000 * soldSupply)
```

## Frontend Integration

### Service: `lib/pumpFunBondingCurveService.ts`

```typescript
import { pumpFunBondingCurveService } from '@/lib/pumpFunBondingCurveService'

// Initialize with provider
await pumpFunBondingCurveService.initialize(provider)

// Get curve info
const info = await pumpFunBondingCurveService.getCurveInfo(curveAddress)
// Returns: { currentPrice, totalLiquidity, marketCap, isActive, tokensSold, maxTokens }

// Get buy quote
const buyQuote = await pumpFunBondingCurveService.getBuyQuote(curveAddress, '100')
// Returns: { inputAmount, outputAmount, fee, pricePerToken }

// Buy tokens
const result = await pumpFunBondingCurveService.buyTokens(
  curveAddress,
  '0.1', // MATIC amount
  '0',   // minTokensOut (0 = auto-calculate with slippage)
  0.5    // slippage tolerance %
)

// Get sell quote
const sellQuote = await pumpFunBondingCurveService.getSellQuote(curveAddress, '100')

// Sell tokens
const result = await pumpFunBondingCurveService.sellTokens(
  curveAddress,
  '100', // token amount
  '0',   // minBaseOut (0 = auto-calculate with slippage)
  0.5    // slippage tolerance %
)
```

## Deployment

### 1. Deploy Factory

```bash
npx hardhat run scripts/deployPumpFunFactory.js --network polygon-amoy
```

Or with custom parameters:
```bash
TREASURY_ADDRESS=0x... \
DEFAULT_FEE_BPS=50 \
DEFAULT_BASE_PRICE=0.0001 \
DEFAULT_PRICE_INCREMENT=0.0000001 \
DEFAULT_GROWTH_RATE_BPS=100 \
DEFAULT_USE_EXPONENTIAL=false \
npx hardhat run scripts/deployPumpFunFactory.js --network polygon-amoy
```

### 2. Update Frontend Config

Add to `.env.local`:
```env
NEXT_PUBLIC_PUMPFUN_FACTORY_ADDRESS=0x...
```

Or update `lib/contract-config.ts`:
```typescript
PUMPFUN_FACTORY_ADDRESS: '0x...'
```

## Usage Example

### Creating a Token

```solidity
// Via factory
PumpFunFactory factory = PumpFunFactory(0x...);
(address token, address curve) = factory.createToken(
  "My Token",
  "MTK",
  1000000 // maxSupply
);
```

### Buying Tokens

```solidity
BondingCurvePool curve = BondingCurvePool(curveAddress);
uint256 tokensOut = curve.buy{value: 0.1 ether}(0.1 ether, 0); // Buy with 0.1 MATIC
```

### Selling Tokens

```solidity
BondingCurvePool curve = BondingCurvePool(curveAddress);
token.approve(curveAddress, 100 ether);
uint256 baseOut = curve.sell(100 ether, 0); // Sell 100 tokens
```

### Closing Curve (Migration to DEX)

```solidity
BondingCurvePool curve = BondingCurvePool(curveAddress);
curve.closeCurve(); // Only owner can call
// After closing, buy() and sell() will revert
```

## Configuration

Default parameters (can be overridden per token):

- **Base Price**: 0.0001 MATIC per token
- **Price Increment**: 0.0000001 MATIC (for linear curve)
- **Growth Rate**: 1% (100 bps, for exponential curve)
- **Fee**: 0.5% (50 bps)
- **Max Supply**: Configurable per token

## Security Features

- ✅ ReentrancyGuard protection
- ✅ SafeERC20 for token transfers
- ✅ Slippage protection (minTokensOut, minBaseOut)
- ✅ Owner-only curve closure
- ✅ Fee limits (max 10%)
- ✅ Input validation

## Gas Optimization

- Uses iterative approximation for curve calculations (max 10 iterations)
- Minimal storage reads/writes
- Efficient event emission
- No unnecessary external calls

## Testing

```bash
npx hardhat test test/BondingCurvePool.test.js
```

## Notes

- The curve uses native MATIC as the base token (baseToken = address(0))
- Tokens are minted on buy and burned on sell
- Price increases monotonically with supply
- Curve can be closed when migrating liquidity to DEX
- All fees go to the treasury address




