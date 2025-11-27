// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./MemeToken.sol";

/**
 * @title BondingCurvePool
 * @notice A pump.fun-style bonding curve that allows buying and selling tokens before DEX migration.
 * @dev Uses a simple monotonic price curve where price increases with supply.
 * 
 * Curve Math:
 * - Price formula: price = basePrice + (soldSupply * priceIncrement)
 * - For exponential: price = basePrice * (1 + growthRate)^soldSupply
 * - When buying: tokensOut = integrate price from currentSupply to (currentSupply + tokensOut)
 * - When selling: baseOut = integrate price from (currentSupply - tokensIn) to currentSupply
 * 
 * Frontend Integration:
 * - Call getPriceForBuy(tokenAmount) to preview cost before buying
 * - Call getPriceForSell(tokenAmount) to preview return before selling
 * - Call buy(baseAmountIn, minTokensOut) with MATIC value = baseAmountIn
 * - Call sell(tokenAmountIn, minBaseOut) after approving tokens
 * - Check curveActive before allowing trades
 * - Read getCurveInfo() for current price, liquidity, market cap
 */
contract BondingCurvePool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /// @notice The meme token being traded
    MemeToken public immutable token;
    
    /// @notice Base token (MATIC native or ERC20 like USDC)
    address public immutable baseToken; // address(0) for native MATIC
    
    /// @notice Initial price per token in base units (e.g., wei for MATIC)
    uint256 public immutable basePrice;
    
    /// @notice Price increment per token sold (linear curve)
    uint256 public immutable priceIncrement;
    
    /// @notice Growth rate for exponential curve (in basis points, e.g., 100 = 1%)
    uint256 public immutable growthRateBps;
    
    /// @notice Whether to use exponential curve (true) or linear (false)
    bool public immutable useExponential;
    
    /// @notice Total base token reserve (MATIC or baseToken)
    uint256 public baseReserve;
    
    /// @notice Total tokens sold from the curve
    uint256 public soldSupply;
    
    /// @notice Maximum supply that can be sold from the curve
    uint256 public immutable maxSupply;
    
    /// @notice Whether the curve is active (can be closed when migrating to DEX)
    bool public curveActive;
    
    /// @notice Treasury address for fees
    address public treasury;
    
    /// @notice Fee in basis points (e.g., 50 = 0.5%)
    uint16 public feeBps;
    
    // Events
    event CurveInitialized(
        address indexed token,
        address indexed baseToken,
        uint256 basePrice,
        uint256 maxSupply,
        bool useExponential
    );
    event Bought(
        address indexed buyer,
        uint256 baseAmountIn,
        uint256 tokensOut,
        uint256 newPrice,
        uint256 newSoldSupply
    );
    event Sold(
        address indexed seller,
        uint256 tokensIn,
        uint256 baseOut,
        uint256 newPrice,
        uint256 newSoldSupply
    );
    event CurveClosed(address indexed token, uint256 finalBaseReserve, uint256 finalSoldSupply);
    event FeeUpdated(uint16 newFeeBps);
    event TreasuryUpdated(address newTreasury);
    
    error CurveNotActive();
    error CurveAlreadyClosed();
    error InsufficientOutput();
    error ZeroAmount();
    error InvalidParams();
    error MaxSupplyExceeded();
    error NotEnoughReserve();
    
    /**
     * @notice Initialize the bonding curve pool
     * @param _token The meme token address
     * @param _baseToken Base token address (address(0) for native MATIC)
     * @param _basePrice Initial price per token
     * @param _priceIncrement Price increment per token (for linear curve)
     * @param _growthRateBps Growth rate in basis points (for exponential curve)
     * @param _useExponential Whether to use exponential curve
     * @param _maxSupply Maximum tokens that can be sold
     * @param _treasury Treasury address for fees
     * @param _feeBps Fee in basis points
     */
    constructor(
        address _token,
        address _baseToken,
        uint256 _basePrice,
        uint256 _priceIncrement,
        uint256 _growthRateBps,
        bool _useExponential,
        uint256 _maxSupply,
        address _treasury,
        uint16 _feeBps
    ) {
        require(_token != address(0), "zero token");
        require(_treasury != address(0), "zero treasury");
        require(_basePrice > 0, "zero base price");
        require(_maxSupply > 0, "zero max supply");
        require(_feeBps <= 1000, "fee too high"); // max 10%
        
        if (_useExponential) {
            require(_growthRateBps > 0 && _growthRateBps <= 10000, "invalid growth rate");
        } else {
            require(_priceIncrement > 0, "zero price increment");
        }
        
        token = MemeToken(_token);
        baseToken = _baseToken;
        basePrice = _basePrice;
        priceIncrement = _priceIncrement;
        growthRateBps = _growthRateBps;
        useExponential = _useExponential;
        maxSupply = _maxSupply;
        treasury = _treasury;
        feeBps = _feeBps;
        curveActive = true;
        
        emit CurveInitialized(_token, _baseToken, _basePrice, _maxSupply, _useExponential);
    }
    
    /**
     * @notice Buy tokens with base token (MATIC or ERC20)
     * @param baseAmountIn Amount of base token to spend
     * @param minTokensOut Minimum tokens to receive (slippage protection)
     * @return tokensOut Amount of tokens received
     * 
     * @dev For native MATIC: send value = baseAmountIn
     * @dev For ERC20: approve this contract first, then call with baseAmountIn
     */
    function buy(uint256 baseAmountIn, uint256 minTokensOut) 
        external 
        payable 
        nonReentrant 
        returns (uint256 tokensOut) 
    {
        if (!curveActive) revert CurveNotActive();
        if (baseAmountIn == 0) revert ZeroAmount();
        
        // Handle native MATIC vs ERC20
        if (baseToken == address(0)) {
            // Native MATIC
            require(msg.value == baseAmountIn, "value mismatch");
        } else {
            // ERC20 base token
            require(msg.value == 0, "no native value");
            IERC20(baseToken).safeTransferFrom(msg.sender, address(this), baseAmountIn);
        }
        
        // Calculate fee
        uint256 fee = (baseAmountIn * feeBps) / 10_000;
        uint256 baseAmountAfterFee = baseAmountIn - fee;
        
        // Calculate tokens out using curve math
        tokensOut = _calculateTokensForBuy(baseAmountAfterFee);
        
        if (tokensOut < minTokensOut) revert InsufficientOutput();
        if (soldSupply + tokensOut > maxSupply) revert MaxSupplyExceeded();
        
        // Update state
        baseReserve += baseAmountAfterFee;
        soldSupply += tokensOut;
        
        // Send fee to treasury
        if (fee > 0) {
            if (baseToken == address(0)) {
                (bool success, ) = payable(treasury).call{value: fee}("");
                require(success, "fee transfer failed");
            } else {
                IERC20(baseToken).safeTransfer(treasury, fee);
            }
        }
        
        // Mint tokens to buyer
        token.mint(msg.sender, tokensOut);
        
        uint256 newPrice = _getCurrentPrice();
        
        emit Bought(msg.sender, baseAmountIn, tokensOut, newPrice, soldSupply);
        
        return tokensOut;
    }
    
    /**
     * @notice Sell tokens for base token
     * @param tokenAmountIn Amount of tokens to sell
     * @param minBaseOut Minimum base token to receive (slippage protection)
     * @return baseOut Amount of base token received
     */
    function sell(uint256 tokenAmountIn, uint256 minBaseOut) 
        external 
        nonReentrant 
        returns (uint256 baseOut) 
    {
        if (!curveActive) revert CurveNotActive();
        if (tokenAmountIn == 0) revert ZeroAmount();
        if (soldSupply < tokenAmountIn) revert NotEnoughReserve();
        
        // Transfer tokens from seller
        token.transferFrom(msg.sender, address(this), tokenAmountIn);
        
        // Calculate base out using curve math
        uint256 baseOutBeforeFee = _calculateBaseForSell(tokenAmountIn);
        
        // Calculate fee
        uint256 fee = (baseOutBeforeFee * feeBps) / 10_000;
        baseOut = baseOutBeforeFee - fee;
        
        if (baseOut < minBaseOut) revert InsufficientOutput();
        if (baseReserve < baseOutBeforeFee) revert NotEnoughReserve();
        
        // Update state
        soldSupply -= tokenAmountIn;
        baseReserve -= baseOutBeforeFee;
        
        // Send fee to treasury
        if (fee > 0) {
            if (baseToken == address(0)) {
                (bool success, ) = payable(treasury).call{value: fee}("");
                require(success, "fee transfer failed");
            } else {
                IERC20(baseToken).safeTransfer(treasury, fee);
            }
        }
        
        // Burn tokens
        token.burn(address(this), tokenAmountIn);
        
        // Send base token to seller
        if (baseToken == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: baseOut}("");
            require(success, "base transfer failed");
        } else {
            IERC20(baseToken).safeTransfer(msg.sender, baseOut);
        }
        
        uint256 newPrice = _getCurrentPrice();
        
        emit Sold(msg.sender, tokenAmountIn, baseOut, newPrice, soldSupply);
        
        return baseOut;
    }
    
    /**
     * @notice Get the price for buying a specific amount of tokens
     * @param tokenAmount Amount of tokens to buy
     * @return baseCost Total base token cost (before fees)
     */
    function getPriceForBuy(uint256 tokenAmount) external view returns (uint256 baseCost) {
        if (soldSupply + tokenAmount > maxSupply) revert MaxSupplyExceeded();
        return _calculateBaseForBuy(tokenAmount);
    }
    
    /**
     * @notice Get the return for selling a specific amount of tokens
     * @param tokenAmount Amount of tokens to sell
     * @return baseReturn Total base token return (before fees)
     */
    function getPriceForSell(uint256 tokenAmount) external view returns (uint256 baseReturn) {
        if (soldSupply < tokenAmount) revert NotEnoughReserve();
        return _calculateBaseForSell(tokenAmount);
    }
    
    /**
     * @notice Get current curve information for frontend
     * @return currentPrice Current price per token
     * @return totalLiquidity Total base reserve
     * @return marketCap Approximate market cap (currentPrice * totalSupply)
     * @return isActive Whether curve is active
     * @return tokensSold Number of tokens sold
     * @return maxTokens Maximum tokens that can be sold
     */
    function getCurveInfo() external view returns (
        uint256 currentPrice,
        uint256 totalLiquidity,
        uint256 marketCap,
        bool isActive,
        uint256 tokensSold,
        uint256 maxTokens
    ) {
        currentPrice = _getCurrentPrice();
        totalLiquidity = baseReserve;
        marketCap = currentPrice * token.totalSupply();
        isActive = curveActive;
        tokensSold = soldSupply;
        maxTokens = maxSupply;
    }
    
    /**
     * @notice Close the curve (called when migrating to DEX)
     * @dev After closing, buy and sell will revert
     */
    function closeCurve() external onlyOwner {
        if (!curveActive) revert CurveAlreadyClosed();
        curveActive = false;
        emit CurveClosed(address(token), baseReserve, soldSupply);
    }
    
    /**
     * @notice Update fee (owner only)
     */
    function setFeeBps(uint16 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "fee too high");
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }
    
    /**
     * @notice Update treasury (owner only)
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "zero treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Calculate tokens received for a buy (before fees)
     * Uses integration of the price curve
     */
    function _calculateTokensForBuy(uint256 baseAmountIn) internal view returns (uint256) {
        if (useExponential) {
            return _calculateTokensExponential(baseAmountIn);
        } else {
            return _calculateTokensLinear(baseAmountIn);
        }
    }
    
    /**
     * @notice Calculate base cost for buying tokens (before fees)
     */
    function _calculateBaseForBuy(uint256 tokenAmount) internal view returns (uint256) {
        if (useExponential) {
            return _calculateBaseExponential(tokenAmount, true);
        } else {
            return _calculateBaseLinear(tokenAmount, true);
        }
    }
    
    /**
     * @notice Calculate base return for selling tokens (before fees)
     */
    function _calculateBaseForSell(uint256 tokenAmount) internal view returns (uint256) {
        if (useExponential) {
            return _calculateBaseExponential(tokenAmount, false);
        } else {
            return _calculateBaseLinear(tokenAmount, false);
        }
    }
    
    /**
     * @notice Linear curve: price = basePrice + (soldSupply * priceIncrement)
     * Integration: baseCost = ∫[soldSupply to soldSupply+tokenAmount] price(s) ds
     */
    function _calculateTokensLinear(uint256 baseAmountIn) internal view returns (uint256) {
        // Solve: baseAmountIn = basePrice * tokens + (priceIncrement * tokens^2) / 2 + priceIncrement * soldSupply * tokens
        // Using quadratic formula: tokens = (-b + sqrt(b^2 + 4ac)) / 2a
        // where a = priceIncrement / 2, b = basePrice + priceIncrement * soldSupply, c = -baseAmountIn
        
        uint256 a = priceIncrement / 2;
        uint256 b = basePrice + (priceIncrement * soldSupply);
        uint256 c = baseAmountIn;
        
        // Simplified: tokens ≈ baseAmountIn / averagePrice
        // Average price = basePrice + priceIncrement * (soldSupply + tokens/2)
        // Iterative approximation for better accuracy
        uint256 tokens = baseAmountIn / (basePrice + priceIncrement * soldSupply);
        uint256 prevTokens = 0;
        
        // Iterate to convergence (max 10 iterations)
        for (uint256 i = 0; i < 10; i++) {
            if (tokens == prevTokens) break;
            prevTokens = tokens;
            uint256 avgPrice = basePrice + priceIncrement * (soldSupply + tokens / 2);
            tokens = baseAmountIn / avgPrice;
        }
        
        return tokens;
    }
    
    /**
     * @notice Calculate base cost/return for linear curve
     */
    function _calculateBaseLinear(uint256 tokenAmount, bool isBuy) internal view returns (uint256) {
        uint256 startSupply = isBuy ? soldSupply : soldSupply - tokenAmount;
        uint256 endSupply = isBuy ? soldSupply + tokenAmount : soldSupply;
        
        // Integration: ∫[start to end] (basePrice + priceIncrement * s) ds
        // = basePrice * (end - start) + priceIncrement * (end^2 - start^2) / 2
        uint256 supplyDiff = endSupply - startSupply;
        uint256 baseCost = basePrice * supplyDiff;
        baseCost += priceIncrement * (endSupply * endSupply - startSupply * startSupply) / 2;
        
        return baseCost;
    }
    
    /**
     * @notice Exponential curve: price = basePrice * (1 + growthRate)^soldSupply
     * Simplified approximation for gas efficiency
     */
    function _calculateTokensExponential(uint256 baseAmountIn) internal view returns (uint256) {
        // Approximation: tokens ≈ baseAmountIn / currentPrice
        // Current price = basePrice * (1 + growthRateBps/10000)^soldSupply
        uint256 currentPrice = _getCurrentPrice();
        uint256 tokens = baseAmountIn / currentPrice;
        
        // Refine with iteration
        for (uint256 i = 0; i < 5; i++) {
            uint256 midSupply = soldSupply + tokens / 2;
            uint256 midPrice = basePrice;
            if (midSupply > 0) {
                // Simplified: (1 + r)^n ≈ 1 + n*r for small r
                midPrice = basePrice + (basePrice * growthRateBps * midSupply) / 10_000;
            }
            tokens = baseAmountIn / midPrice;
        }
        
        return tokens;
    }
    
    /**
     * @notice Calculate base cost/return for exponential curve
     */
    function _calculateBaseExponential(uint256 tokenAmount, bool isBuy) internal view returns (uint256) {
        uint256 startSupply = isBuy ? soldSupply : soldSupply - tokenAmount;
        uint256 endSupply = isBuy ? soldSupply + tokenAmount : soldSupply;
        
        // Simplified integration using average price
        uint256 avgSupply = (startSupply + endSupply) / 2;
        uint256 avgPrice = basePrice;
        if (avgSupply > 0) {
            // Approximation: (1 + r)^n ≈ 1 + n*r
            avgPrice = basePrice + (basePrice * growthRateBps * avgSupply) / 10_000;
        }
        
        return avgPrice * tokenAmount;
    }
    
    /**
     * @notice Get current price per token
     */
    function _getCurrentPrice() internal view returns (uint256) {
        if (useExponential) {
            if (soldSupply == 0) return basePrice;
            // Approximation: (1 + r)^n ≈ 1 + n*r for small r
            return basePrice + (basePrice * growthRateBps * soldSupply) / 10_000;
        } else {
            return basePrice + (priceIncrement * soldSupply);
        }
    }
    
    // Allow receiving native MATIC
    receive() external payable {
        // Only allow if baseToken is native (address(0))
        require(baseToken == address(0), "not native");
        baseReserve += msg.value;
    }
}

