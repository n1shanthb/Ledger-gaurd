// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {ISwapRouter02} from "./interfaces/ISwapRouter02.sol";

/// @title SwapExecutor — Uniswap v3 swap helper for policy fills
contract SwapExecutor {
    address public immutable router;
    address public immutable usdc;
    address public immutable weth;

    uint24 public constant DEFAULT_FEE = 3_000;
    uint24 public constant WETH_USDC_FEE = 500;

    constructor(address _router, address _usdc, address _weth) {
        require(_router != address(0) && _usdc != address(0) && _weth != address(0), "zero addr");
        router = _router;
        usdc = _usdc;
        weth = _weth;
    }

    /// @notice Pulls `amountIn` from caller, swaps to USDC (or WETH if selling USDC), sends out to `recipient`.
    function swapExactIn(
        address tokenIn,
        uint256 amountIn,
        uint256 minOut,
        address recipient
    ) external returns (uint256 amountOut) {
        require(tokenIn != address(0) && recipient != address(0), "zero addr");
        require(amountIn > 0, "zero in");

        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "pull fail");
        require(IERC20(tokenIn).approve(router, amountIn), "approve fail");

        address tokenOut = tokenIn == usdc ? weth : usdc;
        uint24 fee = (tokenIn == weth || tokenOut == weth) && (tokenIn == usdc || tokenOut == usdc)
            ? WETH_USDC_FEE
            : DEFAULT_FEE;

        amountOut = ISwapRouter02(router).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
    }
}
