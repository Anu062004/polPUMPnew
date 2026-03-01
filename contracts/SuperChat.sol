// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SuperChat
/// @notice On-chain Super Chat payments for creator livestream rooms with optional sticker metadata.
contract SuperChat is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant MAX_PLATFORM_FEE_BPS = 2_000; // 20%
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct StreamConfig {
        address creator;
        address payoutAddress;
        bool active;
        uint64 updatedAt;
    }

    address public treasury;
    uint16 public platformFeeBps;
    uint256 public minNativeAmount;

    mapping(bytes32 => StreamConfig) private streams;
    mapping(address => bool) public allowedPaymentTokens;
    mapping(address => uint256) public minTokenAmount;
    mapping(bytes32 => bool) public consumedClientMessageIds;

    error ZeroAddress();
    error InvalidFeeBps(uint16 feeBps);
    error AmountBelowMinimum(uint256 minAmount, uint256 provided);
    error StreamNotConfigured(bytes32 streamId);
    error StreamInactive(bytes32 streamId);
    error TokenNotAllowed(address token);
    error DuplicateClientMessageId(bytes32 clientMessageId);
    error NativeTransferFailed(address to, uint256 amount);
    error DirectNativeTransferDisabled();

    event StreamConfigured(
        bytes32 indexed streamId,
        address indexed creator,
        address indexed streamToken,
        address payoutAddress,
        bool active
    );
    event AllowedPaymentTokenUpdated(address indexed token, bool allowed);
    event MinAmountUpdated(address indexed token, uint256 minAmount);
    event MinNativeAmountUpdated(uint256 minAmount);
    event PlatformFeeUpdated(uint16 previousFeeBps, uint16 newFeeBps);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    event NativeSuperChatPaid(
        bytes32 indexed streamId,
        address indexed sender,
        address indexed creator,
        address streamToken,
        uint256 grossAmount,
        uint256 creatorAmount,
        uint256 platformAmount,
        string messageCid,
        string stickerPack,
        string stickerId,
        bytes32 clientMessageId,
        address payoutAddress
    );

    event TokenSuperChatPaid(
        bytes32 indexed streamId,
        address indexed sender,
        address indexed creator,
        address streamToken,
        address paymentToken,
        uint256 grossAmount,
        uint256 creatorAmount,
        uint256 platformAmount,
        string messageCid,
        string stickerPack,
        string stickerId,
        bytes32 clientMessageId,
        address payoutAddress
    );

    constructor(address treasury_, uint16 platformFeeBps_, uint256 minNativeAmount_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        if (platformFeeBps_ > MAX_PLATFORM_FEE_BPS) revert InvalidFeeBps(platformFeeBps_);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        treasury = treasury_;
        platformFeeBps = platformFeeBps_;
        minNativeAmount = minNativeAmount_;
    }

    function streamIdFor(address creator, address streamToken) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(creator, streamToken));
    }

    function getStream(address creator, address streamToken) external view returns (StreamConfig memory) {
        return streams[streamIdFor(creator, streamToken)];
    }

    function registerOwnStream(address streamToken, address payoutAddress, bool active) external {
        _setStream(msg.sender, streamToken, payoutAddress, active);
    }

    function setStream(address creator, address streamToken, address payoutAddress, bool active)
        external
        onlyRole(OPERATOR_ROLE)
    {
        _setStream(creator, streamToken, payoutAddress, active);
    }

    function setAllowedPaymentToken(address token, bool allowed) external onlyRole(OPERATOR_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        allowedPaymentTokens[token] = allowed;
        emit AllowedPaymentTokenUpdated(token, allowed);
    }

    function setMinTokenAmount(address token, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        minTokenAmount[token] = amount;
        emit MinAmountUpdated(token, amount);
    }

    function setMinNativeAmount(uint256 amount) external onlyRole(OPERATOR_ROLE) {
        minNativeAmount = amount;
        emit MinNativeAmountUpdated(amount);
    }

    function setPlatformFeeBps(uint16 newFeeBps) external onlyRole(OPERATOR_ROLE) {
        if (newFeeBps > MAX_PLATFORM_FEE_BPS) revert InvalidFeeBps(newFeeBps);
        uint16 previous = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(previous, newFeeBps);
    }

    function setTreasury(address newTreasury) external onlyRole(OPERATOR_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        address previous = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previous, newTreasury);
    }

    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    function sendSuperChatNative(
        address creator,
        address streamToken,
        string calldata messageCid,
        string calldata stickerPack,
        string calldata stickerId,
        bytes32 clientMessageId
    )
        external
        payable
        whenNotPaused
        nonReentrant
        returns (bytes32 streamId, uint256 creatorAmount, uint256 platformAmount)
    {
        if (msg.value < minNativeAmount) revert AmountBelowMinimum(minNativeAmount, msg.value);
        streamId = _requireActiveStream(creator, streamToken);
        _markClientMessageId(clientMessageId);

        StreamConfig memory stream = streams[streamId];
        (creatorAmount, platformAmount) = _splitAmount(msg.value);

        if (creatorAmount > 0) _safeTransferNative(stream.payoutAddress, creatorAmount);
        if (platformAmount > 0) _safeTransferNative(treasury, platformAmount);

        emit NativeSuperChatPaid(
            streamId,
            msg.sender,
            creator,
            streamToken,
            msg.value,
            creatorAmount,
            platformAmount,
            messageCid,
            stickerPack,
            stickerId,
            clientMessageId,
            stream.payoutAddress
        );
    }

    function sendSuperChatToken(
        address creator,
        address streamToken,
        address paymentToken,
        uint256 amount,
        string calldata messageCid,
        string calldata stickerPack,
        string calldata stickerId,
        bytes32 clientMessageId
    )
        external
        whenNotPaused
        nonReentrant
        returns (bytes32 streamId, uint256 creatorAmount, uint256 platformAmount)
    {
        if (!allowedPaymentTokens[paymentToken]) revert TokenNotAllowed(paymentToken);
        uint256 minAmount = minTokenAmount[paymentToken];
        if (amount < minAmount) revert AmountBelowMinimum(minAmount, amount);

        streamId = _requireActiveStream(creator, streamToken);
        _markClientMessageId(clientMessageId);

        StreamConfig memory stream = streams[streamId];
        (creatorAmount, platformAmount) = _splitAmount(amount);

        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), amount);
        if (creatorAmount > 0) IERC20(paymentToken).safeTransfer(stream.payoutAddress, creatorAmount);
        if (platformAmount > 0) IERC20(paymentToken).safeTransfer(treasury, platformAmount);

        emit TokenSuperChatPaid(
            streamId,
            msg.sender,
            creator,
            streamToken,
            paymentToken,
            amount,
            creatorAmount,
            platformAmount,
            messageCid,
            stickerPack,
            stickerId,
            clientMessageId,
            stream.payoutAddress
        );
    }

    function emergencyWithdrawNative(uint256 amount, address payable to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        _safeTransferNative(to, amount);
    }

    function emergencyWithdrawToken(address token, uint256 amount, address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    function _setStream(address creator, address streamToken, address payoutAddress, bool active) internal {
        if (creator == address(0) || streamToken == address(0)) revert ZeroAddress();
        if (payoutAddress == address(0)) {
            payoutAddress = creator;
        }

        bytes32 streamId = streamIdFor(creator, streamToken);
        streams[streamId] = StreamConfig({
            creator: creator,
            payoutAddress: payoutAddress,
            active: active,
            updatedAt: uint64(block.timestamp)
        });

        emit StreamConfigured(streamId, creator, streamToken, payoutAddress, active);
    }

    function _requireActiveStream(address creator, address streamToken) internal view returns (bytes32 streamId) {
        if (creator == address(0) || streamToken == address(0)) revert ZeroAddress();
        streamId = streamIdFor(creator, streamToken);
        StreamConfig memory stream = streams[streamId];
        if (stream.creator == address(0)) revert StreamNotConfigured(streamId);
        if (!stream.active) revert StreamInactive(streamId);
    }

    function _splitAmount(uint256 grossAmount) internal view returns (uint256 creatorAmount, uint256 platformAmount) {
        platformAmount = (grossAmount * platformFeeBps) / BPS_DENOMINATOR;
        creatorAmount = grossAmount - platformAmount;
    }

    function _markClientMessageId(bytes32 clientMessageId) internal {
        if (clientMessageId == bytes32(0)) return;
        bytes32 dedupeKey = keccak256(abi.encodePacked(msg.sender, clientMessageId));
        if (consumedClientMessageIds[dedupeKey]) revert DuplicateClientMessageId(clientMessageId);
        consumedClientMessageIds[dedupeKey] = true;
    }

    function _safeTransferNative(address to, uint256 amount) internal {
        (bool success,) = payable(to).call{value: amount}("");
        if (!success) revert NativeTransferFailed(to, amount);
    }

    receive() external payable {
        revert DirectNativeTransferDisabled();
    }

    fallback() external payable {
        revert DirectNativeTransferDisabled();
    }
}
