// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPyth} from "../../src/interfaces/IPyth.sol";
import {ISwapRouter02} from "../../src/interfaces/ISwapRouter02.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory n, string memory s, uint8 d) {
        name = n;
        symbol = s;
        decimals = d;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockPyth {
    int64 public price = 2800e8;
    int32 public expo = -8;
    uint256 public fee;

    function setPrice(int64 p, int32 e) external {
        price = p;
        expo = e;
    }

    function getUpdateFee(bytes[] calldata) external view returns (uint256) {
        return fee;
    }

    function parsePriceFeedUpdates(
        bytes[] calldata,
        bytes32[] calldata priceIds,
        uint64,
        uint64
    ) external payable returns (IPyth.PriceFeed[] memory feeds) {
        feeds = new IPyth.PriceFeed[](priceIds.length);
        IPyth.Price memory pr = IPyth.Price({
            price: price,
            conf: 1,
            expo: expo,
            publishTime: uint64(block.timestamp)
        });
        for (uint256 i = 0; i < priceIds.length; i++) {
            feeds[i] = IPyth.PriceFeed({id: priceIds[i], price: pr, emaPrice: pr});
        }
    }
}

contract MockRouter {
    function exactInputSingle(ISwapRouter02.ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        require(IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn), "in");
        amountOut = params.amountOutMinimum;
        if (amountOut == 0) amountOut = 1;
        MockERC20(params.tokenOut).mint(params.recipient, amountOut);
    }
}
