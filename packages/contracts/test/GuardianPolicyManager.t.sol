// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GuardianPolicyManager} from "../src/GuardianPolicyManager.sol";

contract GuardianPolicyManagerTest is Test {
    GuardianPolicyManager manager;
    address alice = address(0xA11CE);
    address token = address(0xBEEF);

    function setUp() public {
        manager = new GuardianPolicyManager();
    }

    function _expectedPolicyId(address owner, address t, uint256 nonce) internal view returns (bytes32) {
        return keccak256(
            abi.encode(block.chainid, address(manager), owner, t, nonce)
        );
    }

    function test_setGuardianPolicy_emitsEvent() public {
        bytes32 expectedId = _expectedPolicyId(alice, token, 0);

        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit GuardianPolicyManager.PolicyCreated(
            expectedId,
            alice,
            token,
            280_000_00000000,
            1 ether,
            50
        );

        manager.setGuardianPolicy(token, 280_000_00000000, 1 ether, 50);

        assertEq(manager.ownerNonce(alice), 1);
        assertEq(manager.totalPoliciesCreated(), 1);
        assertEq(manager.ownerPolicyCount(alice), 1);
    }

    function test_previewNextPolicyId() public {
        assertEq(manager.previewNextPolicyId(alice, token), _expectedPolicyId(alice, token, 0));

        vm.prank(alice);
        manager.setGuardianPolicy(token, 100, 1 ether, 50);

        assertEq(manager.previewNextPolicyId(alice, token), _expectedPolicyId(alice, token, 1));
    }

    function test_getOwnerPolicyIds_pagination() public {
        vm.startPrank(alice);
        manager.setGuardianPolicy(token, 100, 1 ether, 50);
        manager.setGuardianPolicy(token, 200, 2 ether, 100);
        vm.stopPrank();

        assertEq(manager.ownerPolicyCount(alice), 2);

        bytes32[] memory page = manager.getOwnerPolicyIds(alice, 0, 1);
        assertEq(page.length, 1);
        assertEq(page[0], _expectedPolicyId(alice, token, 0));

        bytes32[] memory rest = manager.getOwnerPolicyIds(alice, 1, 10);
        assertEq(rest.length, 1);
        assertEq(rest[0], _expectedPolicyId(alice, token, 1));
    }

    function test_revokePolicy() public {
        vm.prank(alice);
        manager.setGuardianPolicy(token, 100, 1 ether, 50);

        bytes32 policyId = _expectedPolicyId(alice, token, 0);

        vm.prank(alice);
        manager.revokePolicy(policyId);

        (, , bool active, , , ) = manager.policies(policyId);
        assertFalse(active);
        assertEq(manager.ownerPolicyCount(alice), 1);
    }

    function test_reverts_zeroStopLoss() public {
        vm.prank(alice);
        vm.expectRevert(bytes("zero stop loss"));
        manager.setGuardianPolicy(token, 0, 1 ether, 50);
    }

    function test_reverts_zeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(bytes("zero amount"));
        manager.setGuardianPolicy(token, 100, 0, 50);
    }

    function test_reverts_maxSlippage() public {
        vm.prank(alice);
        vm.expectRevert(bytes("invalid slippage"));
        manager.setGuardianPolicy(token, 100, 1 ether, 10_000);
    }
}
