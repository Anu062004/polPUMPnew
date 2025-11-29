// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IBondingCurvePool
 * @notice Interface for bonding curve pool interactions
 */
interface IBondingCurvePool {
    function token() external view returns (address);
    function baseToken() external view returns (address);
    function basePrice() external view returns (uint256);
    function baseReserve() external view returns (uint256);
    function soldSupply() external view returns (uint256);
    function maxSupply() external view returns (uint256);
    function curveActive() external view returns (bool);
    function feeBps() external view returns (uint16);
    
    function buy(uint256 baseAmountIn, uint256 minTokensOut) external payable returns (uint256);
    function sell(uint256 tokenAmountIn, uint256 minBaseOut) external returns (uint256);
    function getPriceForBuy(uint256 tokenAmount) external view returns (uint256);
    function getPriceForSell(uint256 tokenAmount) external view returns (uint256);
    function getCurveInfo() external view returns (
        uint256 currentPrice,
        uint256 totalLiquidity,
        uint256 marketCap,
        bool isActive,
        uint256 tokensSold,
        uint256 maxTokens
    );
    function closeCurve() external;
}


