// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPyth} from "./interfaces/IPyth.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {SwapExecutor} from "./SwapExecutor.sol";
import {SessionKeyValidator} from "./SessionKeyValidator.sol";

/// @title GuardianPolicyManager — LGA policy registry + execution on Base
/// @notice v2: stop-loss / take-profit / buy-dip, kill switch, Pyth-gated execute, ExecutionReceipt
contract GuardianPolicyManager {
    enum PolicyType { STOP_LOSS, TAKE_PROFIT, LP_STOP_LOSS, BUY_DIP }

    struct Policy {
        address owner;
        uint16 maxSlippageBps;
        bool active;
        uint8 policyType;
        address token;
        uint256 stopLossPrice;
        uint256 takeProfitPrice;
        uint256 maxAmount;
    }

    uint256 public constant MAX_SLIPPAGE_BPS = 9_999;
    uint256 public constant MIN_MAX_AMOUNT = 1;
    uint256 public constant MAX_STALENESS = 60;

    address public immutable pyth;
    SwapExecutor public immutable executor;
    SessionKeyValidator public validator;

    mapping(bytes32 => Policy) public policies;
    mapping(address => bytes32[]) private _ownerPolicies;
    mapping(address => uint256) public ownerNonce;
    mapping(address => bytes32) public priceFeedId;
    uint256 public totalPoliciesCreated;
    uint256 public totalReceipts;

    event PolicyCreated(
        bytes32 indexed policyId,
        address indexed owner,
        address indexed token,
        uint8 policyType,
        uint256 stopLossPrice,
        uint256 takeProfitPrice,
        uint256 maxAmount,
        uint256 maxSlippageBps
    );
    event PolicyRevoked(bytes32 indexed policyId, address indexed owner);
    event KillSwitchActivated(address indexed owner, uint256 policiesRevoked, uint256 timestamp);
    event ExecutionReceipt(
        bytes32 indexed policyId,
        address indexed owner,
        bytes32 indexed receiptId,
        uint8 triggerType,
        uint256 pythPrice,
        uint256 executionPrice,
        uint256 maxSlippageBps,
        uint256 actualSlippageBps,
        bool compliant
    );
    event PriceFeedSet(address indexed token, bytes32 feedId);
    event ValidatorSet(address indexed validator);

    constructor(address _pyth, address _executor, address weth, bytes32 ethUsdFeed, address usdc, bytes32 usdcUsdFeed) {
        require(_pyth != address(0) && _executor != address(0), "zero addr");
        pyth = _pyth;
        executor = SwapExecutor(_executor);
        if (weth != address(0) && ethUsdFeed != bytes32(0)) {
            priceFeedId[weth] = ethUsdFeed;
        }
        if (usdc != address(0) && usdcUsdFeed != bytes32(0)) {
            priceFeedId[usdc] = usdcUsdFeed;
        }
    }

    function setValidator(address _validator) external {
        require(address(validator) == address(0), "already set");
        require(_validator != address(0), "zero addr");
        validator = SessionKeyValidator(_validator);
        emit ValidatorSet(_validator);
    }

    function setPriceFeed(address token, bytes32 feedId) external {
        require(token != address(0) && feedId != bytes32(0), "bad feed");
        // first writer wins per token so demo wallets can seed feeds; owner can overwrite their own? keep open for hackathon
        priceFeedId[token] = feedId;
        emit PriceFeedSet(token, feedId);
    }

    function setGuardianPolicy(
        address token,
        uint8 policyType,
        uint256 stopLossPrice,
        uint256 takeProfitPrice,
        uint256 maxAmount,
        uint256 maxSlippageBps
    ) external {
        require(token != address(0), "zero token");
        require(policyType <= uint8(PolicyType.BUY_DIP), "bad type");
        require(maxAmount >= MIN_MAX_AMOUNT, "zero amount");
        require(maxSlippageBps <= MAX_SLIPPAGE_BPS, "invalid slippage");

        if (policyType == uint8(PolicyType.BUY_DIP)) {
            // token = asset to buy (e.g. WETH); maxAmount = USDC to spend
            require(token != executor.usdc(), "buy base not usdc");
            require(priceFeedId[token] != bytes32(0), "no feed");
            require(stopLossPrice > 0 || takeProfitPrice > 0, "no trigger");
        } else if (policyType == uint8(PolicyType.TAKE_PROFIT)) {
            require(takeProfitPrice > 0, "zero take profit");
        } else {
            require(stopLossPrice > 0, "zero stop loss");
        }

        uint256 nonce = ownerNonce[msg.sender]++;
        bytes32 policyId = keccak256(
            abi.encode(block.chainid, address(this), msg.sender, token, nonce)
        );

        policies[policyId] = Policy({
            owner: msg.sender,
            maxSlippageBps: uint16(maxSlippageBps),
            active: true,
            policyType: policyType,
            token: token,
            stopLossPrice: stopLossPrice,
            takeProfitPrice: takeProfitPrice,
            maxAmount: maxAmount
        });

        _ownerPolicies[msg.sender].push(policyId);
        totalPoliciesCreated++;

        emit PolicyCreated(
            policyId, msg.sender, token, policyType, stopLossPrice, takeProfitPrice, maxAmount, maxSlippageBps
        );
    }

    function revokePolicy(bytes32 policyId) external {
        Policy storage policy = policies[policyId];
        require(policy.owner == msg.sender, "not owner");
        require(policy.active, "inactive");
        policy.active = false;
        emit PolicyRevoked(policyId, msg.sender);
    }

    /// @notice Revoke every active policy for msg.sender and kill session keys.
    function killSwitch() external {
        bytes32[] storage ids = _ownerPolicies[msg.sender];
        uint256 revoked;
        uint256 len = ids.length;
        for (uint256 i = 0; i < len; i++) {
            Policy storage policy = policies[ids[i]];
            if (policy.active) {
                policy.active = false;
                emit PolicyRevoked(ids[i], msg.sender);
                revoked++;
            }
        }
        if (address(validator) != address(0)) {
            validator.kill(msg.sender);
        }
        emit KillSwitchActivated(msg.sender, revoked, block.timestamp);
    }

    function executePolicy(bytes32 policyId, bytes[] calldata priceUpdateData) external payable {
        Policy storage policy = policies[policyId];
        require(policy.active, "inactive");
        require(_canExecute(policy.owner), "not session");

        uint256 pythPrice = _readPythUsd1e8(policy.token, priceUpdateData);

        uint8 triggerType;
        if (policy.stopLossPrice > 0 && pythPrice <= policy.stopLossPrice) {
            triggerType = uint8(PolicyType.STOP_LOSS);
        } else if (policy.takeProfitPrice > 0 && pythPrice >= policy.takeProfitPrice) {
            triggerType = uint8(PolicyType.TAKE_PROFIT);
        } else {
            revert("not triggered");
        }

        address owner = policy.owner;
        address token = policy.token;
        uint16 slip = policy.maxSlippageBps;
        uint256 amountIn = policy.maxAmount;
        bool isBuy = policy.policyType == uint8(PolicyType.BUY_DIP);
        // BUY_DIP: spend USDC, watch `token` feed (e.g. ETH). Else sell `token` → USDC.
        address spend = isBuy ? executor.usdc() : token;
        uint256 expectedOut = _expectedOut(spend, amountIn, pythPrice);
        uint256 minOut = expectedOut * (10_000 - slip) / 10_000;

        require(IERC20(spend).transferFrom(owner, address(this), amountIn), "pull fail");
        require(IERC20(spend).approve(address(executor), amountIn), "approve fail");
        uint256 amountOut = executor.swapExactIn(spend, amountIn, minOut, owner);

        policy.active = false;
        emit PolicyRevoked(policyId, owner);
        _receipt(policyId, owner, spend, triggerType, pythPrice, slip, amountIn, expectedOut, amountOut);
    }

    function _receipt(
        bytes32 policyId,
        address owner,
        address token,
        uint8 triggerType,
        uint256 pythPrice,
        uint16 slip,
        uint256 amountIn,
        uint256 expectedOut,
        uint256 amountOut
    ) internal {
        uint256 actualSlippageBps;
        if (expectedOut > amountOut) {
            actualSlippageBps = (expectedOut - amountOut) * 10_000 / expectedOut;
        }
        bytes32 receiptId = keccak256(abi.encode(policyId, totalReceipts++));
        emit ExecutionReceipt(
            policyId,
            owner,
            receiptId,
            triggerType,
            pythPrice,
            _fillPriceUsd1e8(token, amountIn, amountOut),
            slip,
            actualSlippageBps,
            actualSlippageBps <= slip
        );
    }

    function getPolicy(bytes32 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function ownerPolicyCount(address owner) external view returns (uint256) {
        return _ownerPolicies[owner].length;
    }

    function getOwnerPolicyIds(
        address owner,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory ids) {
        bytes32[] storage all = _ownerPolicies[owner];
        uint256 len = all.length;
        if (offset >= len) return ids;
        uint256 end = offset + limit;
        if (end > len) end = len;
        uint256 size = end - offset;
        ids = new bytes32[](size);
        for (uint256 i = 0; i < size; i++) {
            ids[i] = all[offset + i];
        }
    }

    function previewNextPolicyId(address owner, address token) external view returns (bytes32) {
        return keccak256(
            abi.encode(block.chainid, address(this), owner, token, ownerNonce[owner])
        );
    }

    function _canExecute(address owner) internal view returns (bool) {
        if (address(validator) == address(0)) return msg.sender == owner;
        return validator.isSessionKey(owner, msg.sender);
    }

    function _readPythUsd1e8(address token, bytes[] calldata priceUpdateData) internal returns (uint256) {
        bytes32 feedId = priceFeedId[token];
        require(feedId != bytes32(0), "no feed");

        bytes32[] memory ids = new bytes32[](1);
        ids[0] = feedId;

        uint256 fee = IPyth(pyth).getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "pyth fee");

        uint64 nowTs = uint64(block.timestamp);
        uint64 minT = nowTs > MAX_STALENESS ? nowTs - uint64(MAX_STALENESS) : 0;

        IPyth.PriceFeed[] memory feeds = IPyth(pyth).parsePriceFeedUpdates{value: fee}(
            priceUpdateData,
            ids,
            minT,
            nowTs + uint64(MAX_STALENESS)
        );
        require(feeds.length == 1, "no price");
        require(feeds[0].price.price > 0, "bad price");
        return _toUsd1e8(feeds[0].price.price, feeds[0].price.expo);
    }

    function _toUsd1e8(int64 price, int32 expo) internal pure returns (uint256) {
        int256 scaled = int256(price);
        int256 e = int256(expo) + 8;
        if (e >= 0) {
            return uint256(scaled) * (10 ** uint256(e));
        }
        return uint256(scaled) / (10 ** uint256(-e));
    }

    /// @dev token → USDC (6) or USDC → WETH (18). Pyth usd is 1e8.
    function _expectedOut(address tokenIn, uint256 amountIn, uint256 pythUsd1e8) internal view returns (uint256) {
        address usdc = executor.usdc();
        uint8 dec = IERC20(tokenIn).decimals();
        if (tokenIn == usdc) {
            // USDC → WETH (18): amountIn * 1e(18+8) / pyth / 1e6
            return amountIn * 1e20 / pythUsd1e8;
        }
        // amountIn * usd1e8 / 10^(dec+2) → USDC 6 decimals
        return amountIn * pythUsd1e8 / (10 ** (uint256(dec) + 2));
    }

    function _fillPriceUsd1e8(address tokenIn, uint256 amountIn, uint256 amountOut) internal view returns (uint256) {
        address usdc = executor.usdc();
        if (tokenIn == usdc) {
            if (amountOut == 0) return 0;
            return amountIn * 1e20 / amountOut;
        }
        if (amountIn == 0) return 0;
        uint8 dec = IERC20(tokenIn).decimals();
        return amountOut * (10 ** (uint256(dec) + 2)) / amountIn;
    }
}
