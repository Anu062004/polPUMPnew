/**
 * Centralized ABIs for smart contracts used in the POL Pump application
 */

export const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function createPair(address tokenA, address tokenB) external returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)'
]

export const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external'
]

export const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)'
]

export const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function totalSupply() external view returns (uint256)',
  'function decimals() external view returns (uint8)'
]

export const IWETH_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256) external',
  'function transfer(address to, uint256 amount) external returns (bool)'
]

export const PUMPFUN_FACTORY_ABI = [
  'function createToken(string calldata name, string calldata symbol, uint256 maxSupply) external returns (address tokenAddr, address curveAddr)',
  'function createTokenWithParams(string calldata name, string calldata symbol, uint256 maxSupply, uint256 basePrice, uint256 priceIncrement, uint256 growthRateBps, bool useExponential) external returns (address tokenAddr, address curveAddr)',
  'function tokenToCurve(address) external view returns (address)',
  'function curveToToken(address) external view returns (address)',
  'function tokenToCreator(address) external view returns (address)',
  'function tokenCount() external view returns (uint256)',
  'function getTokens(uint256 offset, uint256 limit) external view returns (address[] memory)',
  'event PairCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 basePrice, uint256 maxSupply)'
]

export const BONDING_CURVE_POOL_ABI = [
  'function token() view returns (address)',
  'function baseToken() view returns (address)',
  'function basePrice() view returns (uint256)',
  'function baseReserve() view returns (uint256)',
  'function soldSupply() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function curveActive() view returns (bool)',
  'function feeBps() view returns (uint16)',
  'function buy(uint256 baseAmountIn, uint256 minTokensOut) payable returns (uint256)',
  'function sell(uint256 tokenAmountIn, uint256 minBaseOut) returns (uint256)',
  'function getPriceForBuy(uint256 tokenAmount) view returns (uint256)',
  'function getPriceForSell(uint256 tokenAmount) view returns (uint256)',
  'function getCurveInfo() view returns (uint256 currentPrice, uint256 totalLiquidity, uint256 marketCap, bool isActive, uint256 tokensSold, uint256 maxTokens)',
  'function closeCurve()',
  'event Bought(address indexed buyer, uint256 baseAmountIn, uint256 tokensOut, uint256 newPrice, uint256 newSoldSupply)',
  'event Sold(address indexed seller, uint256 tokensIn, uint256 baseOut, uint256 newPrice, uint256 newSoldSupply)',
  'event CurveClosed(address indexed token, uint256 finalBaseReserve, uint256 finalSoldSupply)',
  'event CurveInitialized(address indexed token, address indexed baseToken, uint256 basePrice, uint256 maxSupply, bool useExponential)'
]

export default {
  FACTORY_ABI,
  PAIR_ABI,
  ROUTER_ABI,
  ERC20_ABI,
  IWETH_ABI,
  PUMPFUN_FACTORY_ABI,
  BONDING_CURVE_POOL_ABI
}
























