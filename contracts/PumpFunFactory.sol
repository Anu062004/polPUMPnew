// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "./MemeToken.sol";
import "./BondingCurvePool.sol";

/**
 * @title PumpFunFactory
 * @notice Factory for creating pump.fun-style token + bonding curve pairs
 * @dev Each token gets its own bonding curve pool automatically on launch
 */
contract PumpFunFactory {
    using Math for uint256;
    
    event PairCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        uint256 basePrice,
        uint256 maxSupply
    );
    
    /// @notice Treasury address for fees
    address public immutable treasury;
    
    /// @notice Default fee in basis points
    uint16 public immutable defaultFeeBps;
    
    /// @notice Default base price (in wei for MATIC)
    uint256 public immutable defaultBasePrice;
    
    /// @notice Default price increment for linear curve
    uint256 public immutable defaultPriceIncrement;
    
    /// @notice Default growth rate for exponential curve (basis points)
    uint256 public immutable defaultGrowthRateBps;
    
    /// @notice Whether to use exponential curve by default
    bool public immutable defaultUseExponential;
    
    /// @notice Mapping from token to curve
    mapping(address => address) public tokenToCurve;
    
    /// @notice Mapping from curve to token
    mapping(address => address) public curveToToken;
    
    /// @notice Mapping from token to creator
    mapping(address => address) public tokenToCreator;
    
    /// @notice All created tokens
    address[] public allTokens;
    
    constructor(
        address _treasury,
        uint16 _defaultFeeBps,
        uint256 _defaultBasePrice,
        uint256 _defaultPriceIncrement,
        uint256 _defaultGrowthRateBps,
        bool _defaultUseExponential
    ) {
        require(_treasury != address(0), "zero treasury");
        require(_defaultFeeBps <= 1000, "fee too high");
        require(_defaultBasePrice > 0, "zero base price");
        
        treasury = _treasury;
        defaultFeeBps = _defaultFeeBps;
        defaultBasePrice = _defaultBasePrice;
        defaultPriceIncrement = _defaultPriceIncrement;
        defaultGrowthRateBps = _defaultGrowthRateBps;
        defaultUseExponential = _defaultUseExponential;
    }
    
    /**
     * @notice Create a new token with bonding curve using default parameters
     * @param name Token name
     * @param symbol Token symbol
     * @param maxSupply Maximum tokens that can be sold from curve
     * @return tokenAddr Token address
     * @return curveAddr Curve address
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 maxSupply
    ) external returns (address tokenAddr, address curveAddr) {
        return createTokenWithParams(
            name,
            symbol,
            maxSupply,
            defaultBasePrice,
            defaultPriceIncrement,
            defaultGrowthRateBps,
            defaultUseExponential
        );
    }
    
    /**
     * @notice Create a new token with bonding curve using custom parameters
     * @param name Token name
     * @param symbol Token symbol
     * @param maxSupply Maximum tokens that can be sold from curve
     * @param basePrice Initial price per token
     * @param priceIncrement Price increment per token (for linear curve)
     * @param growthRateBps Growth rate in basis points (for exponential curve)
     * @param useExponential Whether to use exponential curve
     * @return tokenAddr Token address
     * @return curveAddr Curve address
     */
    function createTokenWithParams(
        string calldata name,
        string calldata symbol,
        uint256 maxSupply,
        uint256 basePrice,
        uint256 priceIncrement,
        uint256 growthRateBps,
        bool useExponential
    ) public returns (address tokenAddr, address curveAddr) {
        require(bytes(name).length > 0 && bytes(symbol).length > 0, "bad meta");
        require(maxSupply > 0, "zero max supply");
        require(basePrice > 0, "zero base price");
        
        // Deploy token (owner = this factory)
        MemeToken token = new MemeToken(name, symbol, address(this));
        tokenAddr = address(token);
        
        // Deploy bonding curve pool (baseToken = address(0) for native MATIC)
        BondingCurvePool curve = new BondingCurvePool(
            tokenAddr,
            address(0), // Native MATIC
            basePrice,
            priceIncrement,
            growthRateBps,
            useExponential,
            maxSupply,
            treasury,
            defaultFeeBps
        );
        curveAddr = address(curve);
        
        // Set curve as token minter
        token.setMinter(curveAddr);
        
        // Transfer curve ownership to creator
        BondingCurvePool(payable(curveAddr)).transferOwnership(msg.sender);
        
        // Track mappings
        tokenToCurve[tokenAddr] = curveAddr;
        curveToToken[curveAddr] = tokenAddr;
        tokenToCreator[tokenAddr] = msg.sender;
        allTokens.push(tokenAddr);
        
        emit PairCreated(
            tokenAddr,
            curveAddr,
            msg.sender,
            name,
            symbol,
            basePrice,
            maxSupply
        );
        
        return (tokenAddr, curveAddr);
    }
    
    /**
     * @notice Get the number of tokens created
     */
    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }
    
    /**
     * @notice Get all tokens (pagination support)
     * @param offset Starting index
     * @param limit Maximum number to return
     */
    function getTokens(uint256 offset, uint256 limit) 
        external 
        view 
        returns (address[] memory tokens) 
    {
        uint256 length = allTokens.length;
        if (offset >= length) {
            return new address[](0);
        }
        
        uint256 end = offset + limit;
        if (end > length) {
            end = length;
        }
        
        tokens = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            tokens[i - offset] = allTokens[i];
        }
    }
}

