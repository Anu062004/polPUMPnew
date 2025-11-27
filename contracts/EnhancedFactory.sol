// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./MemeToken.sol";
import "./EnhancedBondingCurve.sol";

/// @title Enhanced Factory with Access Control, Events, and Configurable Parameters
/// @notice Deploys MemeToken + EnhancedBondingCurve pairs with comprehensive features
contract EnhancedFactory is AccessControl, Pausable, ReentrancyGuard {
    using SafeMath for uint256;

    // Roles
    bytes32 public constant GAME_ADMIN_ROLE = keccak256("GAME_ADMIN_ROLE");
    bytes32 public constant TOKEN_CREATOR_ROLE = keccak256("TOKEN_CREATOR_ROLE");
    bytes32 public constant CURVE_MANAGER_ROLE = keccak256("CURVE_MANAGER_ROLE");

    // Events
    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        uint256 seedOg,
        uint256 seedTokens,
        uint8 curveType,
        bytes curveParams
    );
    event LiquiditySeeded(
        address indexed token,
        address indexed curve,
        uint256 ogAmount,
        uint256 tokenAmount
    );
    event FeeConfigUpdated(
        uint16 platformFeeBps,
        uint16 creatorFeeBps,
        uint16 burnFeeBps,
        uint16 lpFeeBps
    );
    event ParameterUpdated(string paramName, uint256 oldValue, uint256 newValue);
    event EmergencyPaused(address indexed account);
    event EmergencyUnpaused(address indexed account);
    event TokenCreatorWhitelisted(address indexed creator, bool whitelisted);

    // Configuration
    address public treasury;
    uint16 public defaultFeeBps;
    
    // Fee splitting configuration (basis points, must sum to <= 10000)
    struct FeeSplit {
        uint16 platformFeeBps;  // Platform treasury
        uint16 creatorFeeBps;    // Token creator
        uint16 burnFeeBps;       // Token burn
        uint16 lpFeeBps;         // Liquidity pool reserve
    }
    
    FeeSplit public feeSplit;
    
    // Token tracking
    mapping(address => address) public tokenToCurve; // token => curve
    mapping(address => address) public curveToToken; // curve => token
    mapping(address => address) public tokenToCreator; // token => creator
    address[] public allTokens;
    
    // Whitelist for token creators (if enabled)
    bool public whitelistEnabled;
    mapping(address => bool) public whitelistedCreators;

    constructor(
        address _treasury,
        uint16 _defaultFeeBps,
        FeeSplit memory _feeSplit
    ) {
        require(_treasury != address(0), "zero treasury");
        require(_defaultFeeBps <= 1000, "fee too high");
        require(
            _feeSplit.platformFeeBps + _feeSplit.creatorFeeBps + 
            _feeSplit.burnFeeBps + _feeSplit.lpFeeBps <= 10000,
            "fee split > 100%"
        );

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(GAME_ADMIN_ROLE, msg.sender);
        _setupRole(CURVE_MANAGER_ROLE, msg.sender);

        treasury = _treasury;
        defaultFeeBps = _defaultFeeBps;
        feeSplit = _feeSplit;
    }

    /// @notice Create a new token + bonding curve pair
    /// @param name ERC-20 name
    /// @param symbol ERC-20 symbol
    /// @param seedTokenAmount Initial token inventory
    /// @param curveType Type of bonding curve (0=LINEAR, 1=EXPONENTIAL, 2=SIGMOID)
    /// @param curveParams Encoded curve parameters
    function createPair(
        string calldata name,
        string calldata symbol,
        uint256 seedTokenAmount,
        uint8 curveType,
        bytes calldata curveParams
    ) external payable whenNotPaused nonReentrant returns (address tokenAddr, address curveAddr) {
        // Access control check
        if (whitelistEnabled) {
            require(
                hasRole(TOKEN_CREATOR_ROLE, msg.sender) || whitelistedCreators[msg.sender],
                "not whitelisted"
            );
        }

        require(msg.value > 0, "send OG to seed");
        require(bytes(name).length > 0 && bytes(symbol).length > 0, "bad meta");
        require(seedTokenAmount > 0, "zero token seed");
        require(curveType <= 2, "invalid curve type");

        // Deploy token
        MemeToken token = new MemeToken(name, symbol, address(this));

        // Deploy enhanced curve with configurable parameters
        EnhancedBondingCurve curve = new EnhancedBondingCurve(
            address(token),
            address(this),
            treasury,
            defaultFeeBps,
            feeSplit,
            curveType,
            curveParams
        );

        // Set curve as token minter
        token.setMinter(address(curve));

        // Seed liquidity
        (bool ok, ) = address(curve).call{value: msg.value}(
            abi.encodeWithSelector(EnhancedBondingCurve.seed.selector, seedTokenAmount)
        );
        require(ok, "seed failed");

        // Transfer curve ownership to creator
        curve.transferOwnership(msg.sender);

        // Track mappings
        tokenToCurve[address(token)] = address(curve);
        curveToToken[address(curve)] = address(token);
        tokenToCreator[address(token)] = msg.sender;
        allTokens.push(address(token));

        emit TokenCreated(
            address(token),
            address(curve),
            msg.sender,
            name,
            symbol,
            msg.value,
            seedTokenAmount,
            curveType,
            curveParams
        );

        emit LiquiditySeeded(address(token), address(curve), msg.value, seedTokenAmount);

        return (address(token), address(curve));
    }

    // --- Admin Functions ---

    /// @notice Update fee split configuration
    function setFeeSplit(FeeSplit memory _feeSplit) external onlyRole(CURVE_MANAGER_ROLE) {
        require(
            _feeSplit.platformFeeBps + _feeSplit.creatorFeeBps + 
            _feeSplit.burnFeeBps + _feeSplit.lpFeeBps <= 10000,
            "fee split > 100%"
        );
        FeeSplit memory oldSplit = feeSplit;
        feeSplit = _feeSplit;
        emit FeeConfigUpdated(
            _feeSplit.platformFeeBps,
            _feeSplit.creatorFeeBps,
            _feeSplit.burnFeeBps,
            _feeSplit.lpFeeBps
        );
    }

    /// @notice Update default fee basis points
    function setDefaultFeeBps(uint16 _feeBps) external onlyRole(CURVE_MANAGER_ROLE) {
        require(_feeBps <= 1000, "fee too high");
        uint16 oldFee = defaultFeeBps;
        defaultFeeBps = _feeBps;
        emit ParameterUpdated("defaultFeeBps", oldFee, _feeBps);
    }

    /// @notice Update treasury address
    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "zero addr");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit ParameterUpdated("treasury", uint256(uint160(oldTreasury)), uint256(uint160(_treasury)));
    }

    /// @notice Enable/disable creator whitelist
    function setWhitelistEnabled(bool _enabled) external onlyRole(GAME_ADMIN_ROLE) {
        whitelistEnabled = _enabled;
        emit ParameterUpdated("whitelistEnabled", _enabled ? 1 : 0, _enabled ? 1 : 0);
    }

    /// @notice Whitelist/unwhitelist a creator
    function setWhitelistedCreator(address creator, bool whitelisted) external onlyRole(GAME_ADMIN_ROLE) {
        whitelistedCreators[creator] = whitelisted;
        emit TokenCreatorWhitelisted(creator, whitelisted);
    }

    /// @notice Pause all operations
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    /// @notice Unpause all operations
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    /// @notice Emergency withdraw ERC20 tokens
    function emergencyWithdrawERC20(address tokenAddr, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenAddr != address(0), "zero addr");
        MemeToken(tokenAddr).transfer(treasury, amount);
    }

    /// @notice Emergency withdraw native tokens
    function emergencyWithdrawNative(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        payable(treasury).transfer(amount);
    }

    /// @notice Get total number of tokens created
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    /// @notice Get token address by index
    function getTokenByIndex(uint256 index) external view returns (address) {
        require(index < allTokens.length, "index out of bounds");
        return allTokens[index];
    }
}

