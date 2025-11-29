// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TokenMarketplace
 * @notice Simple custodial marketplace where token owners can deposit ERC-20 tokens
 *         and sell them for native currency (ETH/MATIC).
 *
 * Design goals:
 * - Support any ERC-20 (including fee-on-transfer) using balance-diff accounting.
 * - Keep logic minimal and explicit; pricing is linear (fixed price per unit).
 * - Only the depositor/owner can withdraw tokens or proceeds for their listing.
 */
contract TokenMarketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address token;        // ERC-20 token address
        address depositor;    // token owner / seller
        uint256 pricePerUnit; // price in wei per token unit (10**decimals)
        uint8 decimals;       // decimals used for pricing math
        uint256 remaining;    // remaining amount of tokens for sale (in smallest units)
        uint256 proceeds;     // accumulated native currency proceeds (wei)
        bool exists;          // listing flag
    }

    /// @notice token => listing
    mapping(address => Listing) public listings;

    /// @notice Emitted when tokens are deposited for sale.
    event TokensDeposited(
        address indexed token,
        address indexed depositor,
        uint256 amountReceived,
        uint256 pricePerUnit,
        uint8 decimals
    );

    /// @notice Emitted when tokens are bought.
    event TokenBought(
        address indexed token,
        address indexed buyer,
        uint256 amountBought,
        uint256 valuePaid
    );

    /// @notice Emitted when proceeds are withdrawn.
    event ProceedsWithdrawn(
        address indexed token,
        address indexed depositor,
        uint256 amount
    );

    /// @notice Emitted when remaining tokens are withdrawn.
    event TokensWithdrawn(
        address indexed token,
        address indexed depositor,
        uint256 amount
    );

    error InvalidToken();
    error InvalidAmount();
    error InvalidPrice();
    error ListingNotFound();
    error NotDepositor();
    error NothingToWithdraw();

    modifier onlyDepositor(address token) {
        Listing storage listing = listings[token];
        if (!listing.exists) revert ListingNotFound();
        if (msg.sender != listing.depositor) revert NotDepositor();
        _;
    }

    /**
     * @notice Deposit tokens into the marketplace and set/override price.
     *
     * @param token ERC-20 token address
     * @param amount amount of tokens to deposit (smallest units)
     * @param pricePerUnit price in wei per token unit (10**decimals)
     * @param decimals_ decimals to use for pricing (should match token.decimals())
     */
    function depositTokens(
        address token,
        uint256 amount,
        uint256 pricePerUnit,
        uint8 decimals_
    ) external nonReentrant {
        if (token == address(0)) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        if (pricePerUnit == 0) revert InvalidPrice();

        IERC20 erc20 = IERC20(token);

        // Measure balance before transfer to support fee-on-transfer tokens
        uint256 balanceBefore = erc20.balanceOf(address(this));
        erc20.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = erc20.balanceOf(address(this));

        uint256 received = balanceAfter - balanceBefore;
        if (received == 0) revert InvalidAmount();

        Listing storage listing = listings[token];
        if (!listing.exists) {
            listing.token = token;
            listing.depositor = msg.sender;
            listing.exists = true;
        } else {
            // If listing already exists, ensure same depositor
            if (listing.depositor != msg.sender) revert NotDepositor();
        }

        listing.pricePerUnit = pricePerUnit;
        listing.decimals = decimals_;
        listing.remaining += received;

        emit TokensDeposited(token, msg.sender, received, pricePerUnit, decimals_);
    }

    /**
     * @notice Buy tokens from the marketplace by sending native currency.
     * @dev Uses simple linear pricing: amount = msg.value * 10**decimals / pricePerUnit.
     */
    function buyToken(address token) external payable nonReentrant {
        Listing storage listing = listings[token];
        if (!listing.exists) revert ListingNotFound();
        if (msg.value == 0) revert InvalidAmount();

        // Calculate amount in smallest units (round down)
        uint256 amount = (msg.value * (10 ** listing.decimals)) / listing.pricePerUnit;
        if (amount == 0) revert InvalidAmount();
        require(amount <= listing.remaining, "TokenMarketplace: not enough liquidity");

        listing.remaining -= amount;
        listing.proceeds += msg.value;

        // Transfer tokens to buyer
        IERC20(token).safeTransfer(msg.sender, amount);

        emit TokenBought(token, msg.sender, amount, msg.value);
    }

    /**
     * @notice Withdraw unsold tokens back to the depositor.
     */
    function withdrawTokens(address token, uint256 amount) external nonReentrant onlyDepositor(token) {
        Listing storage listing = listings[token];
        if (amount == 0 || amount > listing.remaining) revert InvalidAmount();

        listing.remaining -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit TokensWithdrawn(token, msg.sender, amount);
    }

    /**
     * @notice Withdraw accumulated proceeds (native currency) for a token listing.
     */
    function withdrawProceeds(address token) external nonReentrant onlyDepositor(token) {
        Listing storage listing = listings[token];
        uint256 amount = listing.proceeds;
        if (amount == 0) revert NothingToWithdraw();

        listing.proceeds = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "TokenMarketplace: withdraw failed");

        emit ProceedsWithdrawn(token, msg.sender, amount);
    }

    /**
     * @notice Get listing info for a token.
     */
    function getListing(
        address token
    )
        external
        view
        returns (
            address depositor,
            uint256 pricePerUnit,
            uint8 decimals_,
            uint256 remaining,
            uint256 proceeds
        )
    {
        Listing storage listing = listings[token];
        require(listing.exists, "TokenMarketplace: listing not found");
        return (listing.depositor, listing.pricePerUnit, listing.decimals, listing.remaining, listing.proceeds);
    }
}





