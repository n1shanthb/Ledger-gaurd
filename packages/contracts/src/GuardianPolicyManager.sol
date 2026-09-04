// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GuardianPolicyManager — LGA policy registry on Base
/// @notice v1: store bounded stop-loss policies; execution + Pyth added in v2
/// @dev stopLossPrice uses Pyth USD scale (1e8). maxSlippageBps: 50 = 0.5%.
contract GuardianPolicyManager {
    /// @dev Packed layout: 4 storage slots (was 6).
    struct Policy {
        address owner;
        uint16 maxSlippageBps;
        bool active;
        address token;
        uint256 stopLossPrice;
        uint256 maxAmount;
    }

    uint256 public constant MAX_SLIPPAGE_BPS = 9_999;
    uint256 public constant MIN_STOP_LOSS_PRICE = 1;
    uint256 public constant MIN_MAX_AMOUNT = 1;

    mapping(bytes32 => Policy) public policies;
    mapping(address => bytes32[]) private _ownerPolicies;
    mapping(address => uint256) public ownerNonce;
    uint256 public totalPoliciesCreated;

    event PolicyCreated(
        bytes32 indexed policyId,
        address indexed owner,
        address indexed token,
        uint256 stopLossPrice,
        uint256 maxAmount,
        uint256 maxSlippageBps
    );

    event PolicyRevoked(bytes32 indexed policyId, address indexed owner);

    /// @notice Register a bounded stop-loss policy for msg.sender.
    /// @param token Protected asset (must be non-zero).
    /// @param stopLossPrice Trigger price in Pyth USD scale (1e8); must be > 0.
    /// @param maxAmount Maximum trade size in token units; must be > 0.
    /// @param maxSlippageBps Max DEX slippage in basis points; must be < 10_000.
    function setGuardianPolicy(
        address token,
        uint256 stopLossPrice,
        uint256 maxAmount,
        uint256 maxSlippageBps
    ) external {
        require(token != address(0), "zero token");
        require(stopLossPrice >= MIN_STOP_LOSS_PRICE, "zero stop loss");
        require(maxAmount >= MIN_MAX_AMOUNT, "zero amount");
        require(maxSlippageBps <= MAX_SLIPPAGE_BPS, "invalid slippage");

        uint256 nonce = ownerNonce[msg.sender]++;
        bytes32 policyId = keccak256(
            abi.encode(block.chainid, address(this), msg.sender, token, nonce)
        );

        policies[policyId] = Policy({
            owner: msg.sender,
            maxSlippageBps: uint16(maxSlippageBps),
            active: true,
            token: token,
            stopLossPrice: stopLossPrice,
            maxAmount: maxAmount
        });

        _ownerPolicies[msg.sender].push(policyId);
        totalPoliciesCreated++;

        emit PolicyCreated(
            policyId, msg.sender, token, stopLossPrice, maxAmount, maxSlippageBps
        );
    }

    function revokePolicy(bytes32 policyId) external {
        Policy storage policy = policies[policyId];
        require(policy.owner == msg.sender, "not owner");
        require(policy.active, "inactive");

        policy.active = false;
        emit PolicyRevoked(policyId, msg.sender);
    }

    /// @notice Returns full policy struct (convenience wrapper over public mapping).
    function getPolicy(bytes32 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    /// @notice Total policies ever created by `owner` (includes revoked; use events for active-only).
    function ownerPolicyCount(address owner) external view returns (uint256) {
        return _ownerPolicies[owner].length;
    }

    /// @notice Paginated policy IDs for an owner. Array includes revoked IDs (historical).
    function getOwnerPolicyIds(
        address owner,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory ids) {
        bytes32[] storage all = _ownerPolicies[owner];
        uint256 len = all.length;
        if (offset >= len) {
            return ids;
        }

        uint256 end = offset + limit;
        if (end > len) end = len;
        uint256 size = end - offset;

        ids = new bytes32[](size);
        for (uint256 i = 0; i < size; i++) {
            ids[i] = all[offset + i];
        }
    }

    /// @notice Preview the policy ID that would be minted on the next call from `owner`.
    function previewNextPolicyId(address owner, address token) external view returns (bytes32) {
        return keccak256(
            abi.encode(block.chainid, address(this), owner, token, ownerNonce[owner])
        );
    }
}
