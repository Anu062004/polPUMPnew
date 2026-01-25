// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./MemeToken.sol";

/// @title Enhanced Bonding Curve with Configurable Types and Fee Splitting
/// @notice Supports multiple curve types: LINEAR, EXPONENTIAL, SIGMOID
contract EnhancedBondingCurve is ReentrancyGuard, Ownable, Pausable {
    using SafeMath for uint256;
    using Address for address payable;

    // Curve Types
    enum CurveType { LINEAR, EXPONENTIAL, SIGMOID }

    // Events
    event Seeded(uint256 ogReserve, uint256 tokenReserve);
    event BuyExecuted(
        address indexed buyer,
        uint256 ogIn,
        uint256 tokensOut,
        uint256 price,
        uint256 priceImpact
    );
    event SellExecuted(
        address indexed seller,
        uint256 tokensIn,
        uint256 ogOut,
        uint256 price,
        uint256 priceImpact
    );
    event FeeTaken(
        address indexed token,
        address indexed feeRecipient,
        uint256 feeAmount,
        string feeType
    );
    event CurveParamsUpdated(uint8 curveType, bytes params);
    event FeeUpdated(uint16 feeBps);
    event TreasuryUpdated(address treasury);

    // Immutable
    MemeToken public immutable token;
    address public treasury;
    address public creator; // Token creator for fee splitting

    // Configuration
    uint16 public feeBps;
    CurveType public curveType;
    bytes public curveParams;

    // Fee splitting
    struct FeeSplit {
        uint16 platformFeeBps;
        uint16 creatorFeeBps;
        uint16 burnFeeBps;
        uint16 lpFeeBps;
    }
    FeeSplit public feeSplit;

    // Reserves
    uint256 public ogReserve;
    uint256 public tokenReserve;
    bool public seeded;

    // Errors
    error AlreadySeeded();
    error InvalidParams();
    error InsufficientOutput();
    error DeadlineExpired();
    error InvalidCurveType();
    error ZeroAmount();

    constructor(
        address _token,
        address _owner,
        address _treasury,
        uint16 _feeBps,
        FeeSplit memory _feeSplit,
        uint8 _curveType,
        bytes memory _curveParams
    ) {
        require(_token != address(0) && _treasury != address(0), "zero addr");
        require(
            _feeSplit.platformFeeBps + _feeSplit.creatorFeeBps + 
            _feeSplit.burnFeeBps + _feeSplit.lpFeeBps <= 10000,
            "fee split > 100%"
        );
        require(_curveType <= 2, "invalid curve type");

        token = MemeToken(_token);
        treasury = _treasury;
        feeBps = _feeBps;
        feeSplit = _feeSplit;
        curveType = CurveType(_curveType);
        curveParams = _curveParams;
        _transferOwnership(_owner);
    }

    /// @notice Set token creator for fee splitting
    function setCreator(address _creator) external onlyOwner {
        require(_creator != address(0), "zero addr");
        creator = _creator;
    }

    /// @notice One-time seeding of initial liquidity
    function seed(uint256 initialTokenAmount) external payable onlyOwner nonReentrant whenNotPaused {
        if (seeded) revert AlreadySeeded();
        if (msg.value == 0 || initialTokenAmount == 0) revert InvalidParams();

        token.mint(address(this), initialTokenAmount);

        ogReserve = msg.value;
        tokenReserve = initialTokenAmount;
        seeded = true;

        emit Seeded(ogReserve, tokenReserve);
    }

    /// @notice Buy tokens with native currency
    function buy(uint256 minTokensOut, uint256 deadline) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
    {
        if (!seeded) revert InvalidParams();
        if (block.timestamp > deadline) revert DeadlineExpired();
        uint256 ogIn = msg.value;
        if (ogIn == 0) revert ZeroAmount();

        // Calculate tokens out based on curve type
        uint256 tokensOut = calculateTokensForBuy(ogIn);
        
        // Apply fee
        uint256 fee = (ogIn * feeBps) / 10_000;
        uint256 ogInAfterFee = ogIn - fee;

        // Recalculate with fee-adjusted input
        tokensOut = calculateTokensForBuy(ogInAfterFee);

        if (tokensOut < minTokensOut) revert InsufficientOutput();

        // Update reserves
        uint256 newOgReserve = ogReserve + ogInAfterFee;
        uint256 newTokenReserve = tokenReserve.sub(tokensOut);
        
        // Safety check
        require(newTokenReserve > 0, "reserve underflow");

        // Effects
        ogReserve = newOgReserve;
        tokenReserve = newTokenReserve;

        // Distribute fees
        distributeFees(fee, address(token), tokensOut);

        // Interactions
        token.transfer(msg.sender, tokensOut);

        // Calculate price and impact
        uint256 price = (ogInAfterFee * 1e18) / tokensOut;
        uint256 priceImpact = calculatePriceImpact(ogInAfterFee, tokensOut, true);

        emit BuyExecuted(msg.sender, ogIn, tokensOut, price, priceImpact);
    }

    /// @notice Sell tokens for native currency
    function sell(uint256 tokensIn, uint256 minOgOut, uint256 deadline) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        if (!seeded) revert InvalidParams();
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (tokensIn == 0) revert ZeroAmount();

        // Pull tokens
        token.transferFrom(msg.sender, address(this), tokensIn);

        // Calculate OG out
        uint256 ogOutBeforeFee = calculateOgForSell(tokensIn);
        
        // Apply fee
        uint256 fee = (ogOutBeforeFee * feeBps) / 10_000;
        uint256 ogOut = ogOutBeforeFee - fee;

        if (ogOut < minOgOut) revert InsufficientOutput();

        // Update reserves
        uint256 newTokenReserve = tokenReserve.add(tokensIn);
        uint256 newOgReserve = ogReserve.sub(ogOutBeforeFee);
        
        // Safety check
        require(newOgReserve > 0, "reserve underflow");

        // Effects
        tokenReserve = newTokenReserve;
        ogReserve = newOgReserve;

        // Distribute fees
        distributeFees(fee, address(token), tokensIn);

        // Interactions
        payable(msg.sender).sendValue(ogOut);

        // Calculate price and impact
        uint256 price = (ogOut * 1e18) / tokensIn;
        uint256 priceImpact = calculatePriceImpact(tokensIn, ogOut, false);

        emit SellExecuted(msg.sender, tokensIn, ogOut, price, priceImpact);
    }

    /// @notice Calculate tokens received for a buy (before fees)
    function calculateTokensForBuy(uint256 ogIn) public view returns (uint256) {
        if (curveType == CurveType.LINEAR) {
            return calculateLinearTokens(ogIn);
        } else if (curveType == CurveType.EXPONENTIAL) {
            return calculateExponentialTokens(ogIn);
        } else if (curveType == CurveType.SIGMOID) {
            return calculateSigmoidTokens(ogIn);
        }
        revert InvalidCurveType();
    }

    /// @notice Calculate OG received for a sell (before fees)
    function calculateOgForSell(uint256 tokensIn) public view returns (uint256) {
        // For constant product, we use x * y = k
        uint256 k = ogReserve * tokenReserve;
        uint256 newTokenReserve = tokenReserve + tokensIn;
        uint256 newOgReserve = k / newTokenReserve;
        return ogReserve.sub(newOgReserve);
    }

    /// @notice Linear curve: tokens = ogIn * slope
    function calculateLinearTokens(uint256 ogIn) internal view returns (uint256) {
        // Extract slope from curveParams (default 1e18 if empty)
        uint256 slope = curveParams.length >= 32 
            ? abi.decode(curveParams, (uint256)) 
            : 1e18;
        return (ogIn * slope) / 1e18;
    }

    /// @notice Exponential curve: tokens = base * (1 + rate)^ogIn
    function calculateExponentialTokens(uint256 ogIn) internal view returns (uint256) {
        // Simplified: tokens = ogIn^exponent (extracted from params)
        uint256 exponent = curveParams.length >= 32 
            ? abi.decode(curveParams, (uint256)) 
            : 1e18;
        // Use fixed-point math approximation
        return (ogIn * exponent) / 1e18;
    }

    /// @notice Sigmoid curve: S-shaped growth
    function calculateSigmoidTokens(uint256 ogIn) internal view returns (uint256) {
        // Simplified sigmoid approximation
        uint256 k = curveParams.length >= 32 
            ? abi.decode(curveParams, (uint256)) 
            : 1e18;
        // tokens = k * ogIn / (1 + ogIn/k)
        uint256 denominator = 1e18 + (ogIn * 1e18) / k;
        return (k * ogIn) / denominator;
    }

    /// @notice Distribute fees according to fee split
    function distributeFees(uint256 totalFee, address tokenAddr, uint256 amount) internal {
        if (totalFee == 0) return;

        // Platform fee
        if (feeSplit.platformFeeBps > 0) {
            uint256 platformFee = (totalFee * feeSplit.platformFeeBps) / 10000;
            payable(treasury).sendValue(platformFee);
            emit FeeTaken(tokenAddr, treasury, platformFee, "platform");
        }

        // Creator fee
        if (feeSplit.creatorFeeBps > 0 && creator != address(0)) {
            uint256 creatorFee = (totalFee * feeSplit.creatorFeeBps) / 10000;
            payable(creator).sendValue(creatorFee);
            emit FeeTaken(tokenAddr, creator, creatorFee, "creator");
        }

        // Burn fee (burn tokens)
        if (feeSplit.burnFeeBps > 0) {
            uint256 burnAmount = (amount * feeSplit.burnFeeBps) / 10000;
            if (burnAmount > 0) {
                token.burn(address(this), burnAmount);
                emit FeeTaken(tokenAddr, address(0), burnAmount, "burn");
            }
        }

        // LP fee (reinvest to reserves)
        if (feeSplit.lpFeeBps > 0) {
            uint256 lpFee = (totalFee * feeSplit.lpFeeBps) / 10000;
            ogReserve = ogReserve + lpFee;
            emit FeeTaken(tokenAddr, address(this), lpFee, "lp");
        }
    }

    /// @notice Calculate price impact percentage
    function calculatePriceImpact(
        uint256 inputAmount,
        uint256 outputAmount,
        bool isBuy
    ) internal view returns (uint256) {
        if (isBuy) {
            uint256 currentPrice = (ogReserve * 1e18) / tokenReserve;
            uint256 executionPrice = (inputAmount * 1e18) / outputAmount;
            if (executionPrice > currentPrice) {
                return ((executionPrice - currentPrice) * 10000) / currentPrice;
            }
        }
        return 0;
    }

    // --- Admin Functions ---

    function setFeeBps(uint16 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "fee too high");
        uint16 oldFee = feeBps;
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
        emit ParameterUpdated("feeBps", oldFee, _feeBps);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "zero addr");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
        emit ParameterUpdated("treasury", uint256(uint160(oldTreasury)), uint256(uint160(_treasury)));
    }

    function setCurveParams(uint8 _curveType, bytes memory _params) external onlyOwner {
        require(_curveType <= 2, "invalid curve type");
        curveType = CurveType(_curveType);
        curveParams = _params;
        emit CurveParamsUpdated(_curveType, _params);
    }

    function pause() external onlyOwner {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    // Events for parameter updates
    event ParameterUpdated(string paramName, uint256 oldValue, uint256 newValue);
    event EmergencyPaused(address indexed account);
    event EmergencyUnpaused(address indexed account);

    receive() external payable {
        // Allow top-ups to reserves
        ogReserve = ogReserve + msg.value;
    }
}

