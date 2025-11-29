// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title GameRegistry
 * @notice Registry of ERC-20 tokens that are allowed to be used in the gaming system.
 *         Stores lightweight config per token and can be queried by games and backend.
 */
contract GameRegistry is Ownable {
    struct TokenConfig {
        address owner;        // token owner / registrant
        uint8 decimals;       // cached decimals (for UI & backend convenience)
        string symbol;        // cached symbol
        uint256 entryFee;     // default entry fee in token units (10**decimals)
        bool registered;      // registration flag
    }

    /// @notice token => config
    mapping(address => TokenConfig) private _tokenConfigs;

    /// @notice Emitted when a token is registered for gaming.
    event TokenRegistered(
        address indexed token,
        address indexed owner,
        uint8 decimals,
        string symbol,
        uint256 entryFee
    );

    /// @notice Emitted when a token's config is updated.
    event TokenConfigUpdated(
        address indexed token,
        uint8 decimals,
        string symbol,
        uint256 entryFee
    );

    /**
     * @notice Register a token as playable in the gaming system.
     * @dev
     * - Anyone can call this, but in practice token owners or platform admin should.
     * - Caches decimals and symbol from the ERC-20 to avoid repeated RPC calls off-chain.
     * @param token ERC-20 token address
     * @param owner_ owner/registrant for this token (can be token owner or platform)
     * @param defaultEntryFee default entry fee denominated in smallest token units
     */
    function registerToken(
        address token,
        address owner_,
        uint256 defaultEntryFee
    ) external {
        require(token != address(0), "GameRegistry: token is zero");
        require(owner_ != address(0), "GameRegistry: owner is zero");

        // Read metadata from token
        IERC20Metadata erc20 = IERC20Metadata(token);
        uint8 decimals = erc20.decimals();
        string memory symbol = erc20.symbol();

        TokenConfig storage cfg = _tokenConfigs[token];
        // First-time registration or update existing
        cfg.owner = owner_;
        cfg.decimals = decimals;
        cfg.symbol = symbol;
        cfg.entryFee = defaultEntryFee;
        cfg.registered = true;

        if (cfg.registered) {
            emit TokenConfigUpdated(token, decimals, symbol, defaultEntryFee);
        } else {
            emit TokenRegistered(token, owner_, decimals, symbol, defaultEntryFee);
        }
    }

    /**
     * @notice Admin-only override for entry fee without touching cached metadata.
     */
    function updateEntryFee(address token, uint256 newEntryFee) external onlyOwner {
        TokenConfig storage cfg = _tokenConfigs[token];
        require(cfg.registered, "GameRegistry: token not registered");
        cfg.entryFee = newEntryFee;
        emit TokenConfigUpdated(token, cfg.decimals, cfg.symbol, newEntryFee);
    }

    /**
     * @notice Returns true if a token is registered.
     */
    function isTokenRegistered(address token) external view returns (bool) {
        return _tokenConfigs[token].registered;
    }

    /**
     * @notice Get full token config.
     * @return owner_ owner/registrant
     * @return decimals_ cached decimals
     * @return symbol_ cached symbol
     * @return entryFee_ default entry fee in smallest units
     */
    function getTokenConfig(
        address token
    )
        external
        view
        returns (address owner_, uint8 decimals_, string memory symbol_, uint256 entryFee_)
    {
        TokenConfig storage cfg = _tokenConfigs[token];
        require(cfg.registered, "GameRegistry: token not registered");
        return (cfg.owner, cfg.decimals, cfg.symbol, cfg.entryFee);
    }
}





