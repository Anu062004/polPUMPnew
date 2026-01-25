[dotenv@17.2.3] injecting env (6) from .env -- tip: 🔐 prevent committing .env to code: https://dotenvx.com/precommit
// Sources flattened with hardhat v2.27.0 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.4) (utils/Context.sol)

pragma solidity ^0.8.0;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/token/ERC20/IERC20.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC20/IERC20.sol)

pragma solidity ^0.8.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}


// File @openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (token/ERC20/extensions/IERC20Metadata.sol)

pragma solidity ^0.8.0;

/**
 * @dev Interface for the optional metadata functions from the ERC20 standard.
 *
 * _Available since v4.1._
 */
interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}


// File contracts/GameRegistry.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.24;
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
