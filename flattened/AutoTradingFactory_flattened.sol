[dotenv@17.2.3] injecting env (6) from .env -- tip: 🗂️ backup and recover secrets: https://dotenvx.com/ops
// Sources flattened with hardhat v2.27.0 https://hardhat.org

// SPDX-License-Identifier: MIT

// File contracts/DEX/interfaces/IERC20.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint value) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);
}


// File contracts/DEX/interfaces/IUniswapV2Factory.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.0;

interface IUniswapV2Factory {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);

    function createPair(address tokenA, address tokenB) external returns (address pair);

    function setFeeTo(address) external;
    function setFeeToSetter(address) external;
}


// File contracts/DEX/interfaces/IUniswapV2Router02.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.0;

interface IUniswapV2Router02 {
    function factory() external view returns (address);
    function WETH() external view returns (address);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
    
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB);
    
    function removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external returns (uint amountToken, uint amountETH);

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);
    
    function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);
    
    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);
    
    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);

    function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB);
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut);
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) external pure returns (uint amountIn);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts);
}


// File contracts/DEX/interfaces/IWETH.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.0;

interface IWETH {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
}


// File contracts/AutoTradingFactory.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.20;
/**
 * @title AutoTradingFactory
 * @dev Automatically enables trading for new tokens by creating pairs and adding liquidity
 * This makes your platform work like pump.fun - tokens are instantly tradable
 */
contract AutoTradingFactory {
    
    // DEX contracts
    IUniswapV2Factory public immutable factory;
    IUniswapV2Router02 public immutable router;
    IWETH public immutable WETH;
    
    // Owner and fee recipient
    address public owner;
    address public feeRecipient;
    
    // Fee configuration (0.5% of liquidity added)
    uint256 public constant FEE_BPS = 50; // 0.5%
    
    // Events
    event TradingEnabled(
        address indexed token,
        address indexed pair,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 lpTokens
    );
    
    event FeeCollected(
        address indexed token,
        uint256 feeAmount
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(
        address _factory,
        address _router,
        address _weth,
        address _feeRecipient
    ) {
        require(_factory != address(0), "Invalid factory");
        require(_router != address(0), "Invalid router");
        require(_weth != address(0), "Invalid WETH");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        factory = IUniswapV2Factory(_factory);
        router = IUniswapV2Router02(_router);
        WETH = IWETH(_weth);
        owner = msg.sender;
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Enable trading for a token by creating pair and adding liquidity (internal)
     * @param token Token address to enable trading for
     * @param tokenAmount Amount of tokens to add to liquidity
     * @param ethAmount Amount of ETH to add to liquidity
     */
    function _enableTradingForToken(
        address token,
        uint256 tokenAmount,
        uint256 ethAmount
    ) internal returns (address pair) {
        require(token != address(0), "Invalid token");
        require(tokenAmount > 0, "Invalid token amount");
        require(ethAmount > 0, "Invalid ETH amount");
        
        // Check if pair already exists
        pair = factory.getPair(token, address(WETH));
        
        if (pair == address(0)) {
            // Create new pair
            pair = factory.createPair(token, address(WETH));
            require(pair != address(0), "Pair creation failed");
        }
        
        // Approve router to spend tokens
        IERC20(token).approve(address(router), tokenAmount);
        
        // Calculate fee
        uint256 feeAmount = (ethAmount * FEE_BPS) / 10000;
        uint256 netEthAmount = ethAmount - feeAmount;
        
        // Add liquidity
        (uint256 tokensUsed, uint256 ethUsed, uint256 lpTokens) = router.addLiquidityETH{value: netEthAmount}(
            token,
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            msg.sender, // LP tokens go to caller
            block.timestamp + 1800 // 30 minutes deadline
        );
        
        // Send fee to recipient
        if (feeAmount > 0) {
            payable(feeRecipient).transfer(feeAmount);
            emit FeeCollected(token, feeAmount);
        }
        
        // Refund excess tokens
        uint256 excessTokens = tokenAmount - tokensUsed;
        if (excessTokens > 0) {
            IERC20(token).transfer(msg.sender, excessTokens);
        }
        
        emit TradingEnabled(token, pair, tokensUsed, ethUsed, lpTokens);
    }

    /**
     * @dev Enable trading for a token by creating pair and adding liquidity (external)
     * @param token Token address to enable trading for
     * @param tokenAmount Amount of tokens to add to liquidity
     * @param ethAmount Amount of ETH to add to liquidity
     */
    function enableTradingForToken(
        address token,
        uint256 tokenAmount,
        uint256 ethAmount
    ) external payable returns (address pair) {
        require(msg.value >= ethAmount, "Insufficient ETH sent");
        
        // Transfer tokens from caller to this contract
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);
        
        pair = _enableTradingForToken(token, tokenAmount, ethAmount);
        
        // Refund excess ETH
        uint256 excessEth = msg.value - ethAmount;
        if (excessEth > 0) {
            payable(msg.sender).transfer(excessEth);
        }
    }
    
    /**
     * @dev Enable trading for multiple tokens at once
     * @param tokens Array of token addresses
     * @param tokenAmounts Array of token amounts
     * @param ethAmounts Array of ETH amounts
     */
    function enableTradingForMultipleTokens(
        address[] calldata tokens,
        uint256[] calldata tokenAmounts,
        uint256[] calldata ethAmounts
    ) external payable returns (address[] memory pairs) {
        require(
            tokens.length == tokenAmounts.length && 
            tokens.length == ethAmounts.length,
            "Array length mismatch"
        );
        
        uint256 totalEthRequired = 0;
        for (uint256 i = 0; i < ethAmounts.length; i++) {
            totalEthRequired += ethAmounts[i];
        }
        
        require(msg.value >= totalEthRequired, "Insufficient ETH sent");
        
        pairs = new address[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            // Transfer tokens from caller to this contract
            IERC20(tokens[i]).transferFrom(msg.sender, address(this), tokenAmounts[i]);
            
            pairs[i] = _enableTradingForToken(
                tokens[i],
                tokenAmounts[i],
                ethAmounts[i]
            );
        }
    }
    
    /**
     * @dev Check if a token has trading enabled
     * @param token Token address to check
     * @return hasTrading Whether trading is enabled
     * @return pairAddress Address of the trading pair
     */
    function hasTradingEnabled(address token) external view returns (bool hasTrading, address pairAddress) {
        pairAddress = factory.getPair(token, address(WETH));
        hasTrading = pairAddress != address(0);
    }
    
    /**
     * @dev Get trading statistics for a token
     * @param token Token address
     * @return pairAddress Address of trading pair
     * @return tokenReserve Token reserve in pair
     * @return ethReserve ETH reserve in pair
     * @return totalSupply Total supply of LP tokens
     */
    function getTradingStats(address token) external view returns (
        address pairAddress,
        uint256 tokenReserve,
        uint256 ethReserve,
        uint256 totalSupply
    ) {
        pairAddress = factory.getPair(token, address(WETH));
        if (pairAddress == address(0)) {
            return (address(0), 0, 0, 0);
        }
        
        // Get reserves from pair
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pairAddress).getReserves();
        address token0 = IUniswapV2Pair(pairAddress).token0();
        
        if (token0 == token) {
            tokenReserve = reserve0;
            ethReserve = reserve1;
        } else {
            tokenReserve = reserve1;
            ethReserve = reserve0;
        }
        
        totalSupply = IUniswapV2Pair(pairAddress).totalSupply();
    }
    
    /**
     * @dev Update fee recipient (owner only)
     * @param newFeeRecipient New fee recipient address
     */
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        require(newFeeRecipient != address(0), "Invalid address");
        feeRecipient = newFeeRecipient;
    }
    
    /**
     * @dev Transfer ownership (owner only)
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
    
    /**
     * @dev Emergency function to recover stuck tokens (owner only)
     * @param token Token address to recover
     * @param amount Amount to recover
     */
    function emergencyRecover(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner).transfer(amount);
        } else {
            IERC20(token).transfer(owner, amount);
        }
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
}

// Interface for UniswapV2Pair
interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function totalSupply() external view returns (uint256);
}
