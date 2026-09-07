// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Indexes Hedera x402 / HCS refs next to Base fills for Receipt Graph.
contract PaymentAuditLog {
    event PaymentAudit(
        bytes32 indexed attemptId,
        bytes32 indexed policyId,
        bytes32 baseTx,
        string hederaPaymentRef,
        string hcsRef,
        uint256 timestamp
    );

    function recordPaymentAudit(
        bytes32 attemptId,
        bytes32 policyId,
        bytes32 baseTx,
        string calldata hederaPaymentRef,
        string calldata hcsRef
    ) external {
        emit PaymentAudit(
            attemptId,
            policyId,
            baseTx,
            hederaPaymentRef,
            hcsRef,
            block.timestamp
        );
    }
}
