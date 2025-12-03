// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GameBank
 * @notice Simple custodial balance manager for games.
 *
 * Users deposit ERC-20 tokens into the bank, and game contracts can spend/award balances.
 * This is optional; games can also operate in non-custodial mode by using transferFrom
 * directly from user wallets instead of going through this bank.
 */
contract GameBank is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice user => token => balance (in smallest units)
    mapping(address => mapping(address => uint256)) private _balances;

    /// @notice game contract allowlist
    mapping(address => bool) public isGame;

    event GameSet(address indexed game, bool allowed);
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Spent(address indexed game, address indexed user, address indexed token, uint256 amount);
    event Awarded(address indexed game, address indexed user, address indexed token, uint256 amount);

    error NotGame();
    error InvalidToken();
    error InvalidAmount();
    error InsufficientBalance();

    modifier onlyGame() {
        if (!isGame[msg.sender]) revert NotGame();
        _;
    }

    /**
     * @notice Configure game contracts that are allowed to spend/award balances.
     */
    function setGame(address game, bool allowed) external onlyOwner {
        isGame[game] = allowed;
        emit GameSet(game, allowed);
    }

    /**
     * @notice Deposit tokens into the GameBank for gaming.
     * @dev Caller must approve this contract for `amount` beforehand.
     *      Uses balance-diff accounting to support fee-on-transfer tokens.
     */
    function depositForGame(address token, uint256 amount) external nonReentrant {
        if (token == address(0)) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();

        IERC20 erc20 = IERC20(token);

        uint256 balanceBefore = erc20.balanceOf(address(this));
        erc20.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = erc20.balanceOf(address(this));

        uint256 received = balanceAfter - balanceBefore;
        if (received == 0) revert InvalidAmount();

        _balances[msg.sender][token] += received;

        emit Deposited(msg.sender, token, received);
    }

    /**
     * @notice View function to check a user's in-bank token balance.
     */
    function balanceOf(address user, address token) external view returns (uint256) {
        return _balances[user][token];
    }

    /**
     * @notice Spend tokens from a user's in-bank balance.
     * @dev Only callable by approved game contracts.
     */
    function spend(address user, address token, uint256 amount) external onlyGame nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 bal = _balances[user][token];
        if (bal < amount) revert InsufficientBalance();

        _balances[user][token] = bal - amount;

        // Tokens remain in the bank contract; they are considered "burned" for game entry fees
        // or can be managed by game-specific accounting logic.
        emit Spent(msg.sender, user, token, amount);
    }

    /**
     * @notice Award tokens to a user's in-bank balance.
     * @dev Only callable by approved game contracts.
     *      Assumes the bank already holds enough tokens for potential withdrawals.
     */
    function award(address user, address token, uint256 amount) external onlyGame nonReentrant {
        if (amount == 0) revert InvalidAmount();
        _balances[user][token] += amount;

        emit Awarded(msg.sender, user, token, amount);
    }
}







