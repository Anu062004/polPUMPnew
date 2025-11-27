// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MemeToken.sol";

/// @title Secure Constant-Product Bonding Curve AMM
/// @notice x * y = k bonding curve with comprehensive security features
/// @dev Enhanced with: pause, timelock, input validation, events
contract SecureBondingCurve is ReentrancyGuard, Ownable, Pausable {
    using SafeMath for uint256;
    using Address for address payable;

    // Constants
    uint256 private constant MAX_FEE_BPS = 1000; // 10% maximum fee
    uint256 private constant MIN_RESERVE = 1e15; // Minimum 0.001 ETH reserve
    uint256 private constant MAX_SLIPPAGE_BPS = 5000; // 50% maximum slippage
    uint256 private constant FEE_CHANGE_DELAY = 24 hours; // Timelock for fee changes
    
    // Events
    event Seeded(uint256 ogReserve, uint256 tokenReserve, uint256 timestamp);
    event Buy(
        address indexed buyer,
        uint256 ogIn,
        uint256 tokensOut,
        uint256 fee,
        uint256 priceImpact,
        uint256 timestamp
    );
    event Sell(
        address indexed seller,
        uint256 tokensIn,
        uint256 ogOut,
        uint256 fee,
        uint256 priceImpact,
        uint256 timestamp
    );
    event FeeUpdateScheduled(uint16 newFeeBps, uint256 effectiveTime);
    event FeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
    
    // Immutable
    MemeToken public immutable token;
    
    // State
    address public treasury;
    uint16 public feeBps;
    uint256 public ogReserve;
    uint256 public tokenReserve;
    bool public seeded;
    
    // Timelock for fee changes
    uint16 public pendingFeeBps;
    uint256 public feeChangeTime;
    
    // Errors
    error AlreadySeeded();
    error NotSeeded();
    error InvalidParams();
    error InsufficientOutput();
    error DeadlineExpired();
    error ZeroAmount();
    error ZeroAddress();
    error FeeTooHigh();
    error SlippageTooHigh();
    error ReserveTooLow();
    error FeeChangeNotReady();
    
    /// @notice Constructor
    /// @param _token Token address
    /// @param _owner Owner address
    /// @param _treasury Treasury address for fees
    /// @param _feeBps Initial fee in basis points
    constructor(
        address _token,
        address _owner,
        address _treasury,
        uint16 _feeBps
    ) {
        if (_token == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        
        token = MemeToken(_token);
        treasury = _treasury;
        feeBps = _feeBps;
        _transferOwnership(_owner);
    }
    
    /// @notice One-time seeding of initial liquidity
    /// @param initialTokenAmount Amount of tokens to seed
    function seed(uint256 initialTokenAmount) 
        external 
        payable 
        onlyOwner 
        nonReentrant 
        whenNotPaused 
    {
        if (seeded) revert AlreadySeeded();
        if (msg.value < MIN_RESERVE) revert ReserveTooLow();
        if (initialTokenAmount == 0) revert ZeroAmount();
        
        // Mint tokens to this contract
        token.mint(address(this), initialTokenAmount);
        
        ogReserve = msg.value;
        tokenReserve = initialTokenAmount;
        seeded = true;
        
        emit Seeded(ogReserve, tokenReserve, block.timestamp);
    }
    
    /// @notice Buy tokens with native currency
    /// @param minTokensOut Minimum tokens to receive (slippage protection)
    /// @param deadline Transaction deadline
    function buy(uint256 minTokensOut, uint256 deadline) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
    {
        if (!seeded) revert NotSeeded();
        if (block.timestamp >= deadline) revert DeadlineExpired();
        if (msg.value == 0) revert ZeroAmount();
        
        uint256 ogIn = msg.value;
        
        // Calculate fee
        uint256 fee = ogIn.mul(feeBps).div(10_000);
        uint256 ogInAfterFee = ogIn.sub(fee);
        
        // Calculate tokens out using x*y=k
        uint256 k = ogReserve.mul(tokenReserve);
        uint256 newOgReserve = ogReserve.add(ogInAfterFee);
        uint256 newTokenReserve = k.div(newOgReserve);
        uint256 tokensOut = tokenReserve.sub(newTokenReserve);
        
        // Slippage check
        if (tokensOut < minTokensOut) revert InsufficientOutput();
        
        // Calculate price impact
        uint256 priceImpact = tokensOut.mul(10_000).div(tokenReserve);
        if (priceImpact > MAX_SLIPPAGE_BPS) revert SlippageTooHigh();
        
        // Update reserves
        ogReserve = newOgReserve;
        tokenReserve = newTokenReserve;
        
        // Send fee to treasury
        if (fee > 0) {
            payable(treasury).sendValue(fee);
        }
        
        // Transfer tokens to buyer
        token.transfer(msg.sender, tokensOut);
        
        emit Buy(msg.sender, ogIn, tokensOut, fee, priceImpact, block.timestamp);
    }
    
    /// @notice Sell tokens for native currency
    /// @param tokensIn Amount of tokens to sell
    /// @param minOgOut Minimum native currency to receive
    /// @param deadline Transaction deadline
    function sell(uint256 tokensIn, uint256 minOgOut, uint256 deadline) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        if (!seeded) revert NotSeeded();
        if (block.timestamp >= deadline) revert DeadlineExpired();
        if (tokensIn == 0) revert ZeroAmount();
        
        // Pull tokens from seller
        token.transferFrom(msg.sender, address(this), tokensIn);
        
        // Calculate OG out using x*y=k
        uint256 k = ogReserve.mul(tokenReserve);
        uint256 newTokenReserve = tokenReserve.add(tokensIn);
        uint256 newOgReserve = k.div(newTokenReserve);
        uint256 ogOutBeforeFee = ogReserve.sub(newOgReserve);
        
        // Calculate fee
        uint256 fee = ogOutBeforeFee.mul(feeBps).div(10_000);
        uint256 ogOut = ogOutBeforeFee.sub(fee);
        
        // Slippage check
        if (ogOut < minOgOut) revert InsufficientOutput();
        
        // Calculate price impact
        uint256 priceImpact = tokensIn.mul(10_000).div(tokenReserve);
        if (priceImpact > MAX_SLIPPAGE_BPS) revert SlippageTooHigh();
        
        // Update reserves
        ogReserve = newOgReserve;
        tokenReserve = newTokenReserve;
        
        // Send fee to treasury
        if (fee > 0) {
            payable(treasury).sendValue(fee);
        }
        
        // Send OG to seller
        payable(msg.sender).sendValue(ogOut);
        
        emit Sell(msg.sender, tokensIn, ogOut, fee, priceImpact, block.timestamp);
    }
    
    /// @notice Get quote for buying tokens
    /// @param ogIn Amount of native currency to spend
    /// @return tokensOut Amount of tokens to receive
    /// @return fee Fee amount
    function getBuyQuote(uint256 ogIn) 
        external 
        view 
        returns (uint256 tokensOut, uint256 fee) 
    {
        if (!seeded || ogIn == 0) return (0, 0);
        
        fee = ogIn.mul(feeBps).div(10_000);
        uint256 ogInAfterFee = ogIn.sub(fee);
        
        uint256 k = ogReserve.mul(tokenReserve);
        uint256 newOgReserve = ogReserve.add(ogInAfterFee);
        uint256 newTokenReserve = k.div(newOgReserve);
        tokensOut = tokenReserve.sub(newTokenReserve);
    }
    
    /// @notice Get quote for selling tokens
    /// @param tokensIn Amount of tokens to sell
    /// @return ogOut Amount of native currency to receive
    /// @return fee Fee amount
    function getSellQuote(uint256 tokensIn) 
        external 
        view 
        returns (uint256 ogOut, uint256 fee) 
    {
        if (!seeded || tokensIn == 0) return (0, 0);
        
        uint256 k = ogReserve.mul(tokenReserve);
        uint256 newTokenReserve = tokenReserve.add(tokensIn);
        uint256 newOgReserve = k.div(newTokenReserve);
        uint256 ogOutBeforeFee = ogReserve.sub(newOgReserve);
        
        fee = ogOutBeforeFee.mul(feeBps).div(10_000);
        ogOut = ogOutBeforeFee.sub(fee);
    }
    
    // --- Admin Functions with Timelock ---
    
    /// @notice Schedule fee change (requires timelock)
    /// @param _feeBps New fee in basis points
    function scheduleFeeChange(uint16 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        
        pendingFeeBps = _feeBps;
        feeChangeTime = block.timestamp + FEE_CHANGE_DELAY;
        
        emit FeeUpdateScheduled(_feeBps, feeChangeTime);
    }
    
    /// @notice Execute scheduled fee change
    function executeFeeChange() external onlyOwner {
        if (block.timestamp < feeChangeTime) revert FeeChangeNotReady();
        if (feeChangeTime == 0) revert InvalidParams();
        
        uint16 oldFee = feeBps;
        feeBps = pendingFeeBps;
        
        // Reset timelock
        pendingFeeBps = 0;
        feeChangeTime = 0;
        
        emit FeeUpdated(oldFee, feeBps);
    }
    
    /// @notice Update treasury address
    /// @param _treasury New treasury address
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        
        address oldTreasury = treasury;
        treasury = _treasury;
        
        emit TreasuryUpdated(oldTreasury, _treasury);
    }
    
    /// @notice Pause trading
    function pause() external onlyOwner {
        _pause();
    }
    
    /// @notice Unpause trading
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /// @notice Emergency withdraw (only if paused)
    /// @param _token Token to withdraw (address(0) for native)
    /// @param _to Recipient address
    /// @param _amount Amount to withdraw
    function emergencyWithdraw(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner whenPaused {
        if (_to == address(0)) revert ZeroAddress();
        
        if (_token == address(0)) {
            payable(_to).sendValue(_amount);
        } else {
            MemeToken(_token).transfer(_to, _amount);
        }
        
        emit EmergencyWithdraw(_token, _to, _amount);
    }
    
    /// @notice Reject direct ETH transfers
    receive() external payable {
        revert("Use buy() function");
    }
}
