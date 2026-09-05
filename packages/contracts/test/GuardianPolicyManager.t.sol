// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GuardianPolicyManager} from "../src/GuardianPolicyManager.sol";
import {SwapExecutor} from "../src/SwapExecutor.sol";
import {SessionKeyValidator} from "../src/SessionKeyValidator.sol";
import {MockERC20, MockPyth, MockRouter} from "./mocks/Mocks.sol";

contract GuardianPolicyManagerTest is Test {
    GuardianPolicyManager manager;
    SwapExecutor executor;
    SessionKeyValidator validator;
    MockPyth pyth;
    MockRouter router;
    MockERC20 weth;
    MockERC20 usdc;

    address alice = address(0xA11CE);
    address keeper = address(0xB0B);
    bytes32 ethUsd = keccak256("ETH_USD");

    function setUp() public {
        pyth = new MockPyth();
        router = new MockRouter();
        weth = new MockERC20("WETH", "WETH", 18);
        usdc = new MockERC20("USDC", "USDC", 6);
        executor = new SwapExecutor(address(router), address(usdc), address(weth));
        manager = new GuardianPolicyManager(
            address(pyth), address(executor), address(weth), ethUsd, address(usdc), keccak256("USDC_USD")
        );
        validator = new SessionKeyValidator();
        manager.setValidator(address(validator));
        validator.setManager(address(manager));
    }

    function _expectedPolicyId(address owner, address t, uint256 nonce) internal view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(manager), owner, t, nonce));
    }

    function test_setGuardianPolicy_emitsEvent() public {
        bytes32 expectedId = _expectedPolicyId(alice, address(weth), 0);

        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit GuardianPolicyManager.PolicyCreated(
            expectedId, alice, address(weth), 0, 280_000_00000000, 0, 1 ether, 50
        );
        manager.setGuardianPolicy(address(weth), 0, 280_000_00000000, 0, 1 ether, 50);

        assertEq(manager.ownerNonce(alice), 1);
        assertEq(manager.totalPoliciesCreated(), 1);
        assertEq(manager.ownerPolicyCount(alice), 1);
    }

    function test_previewNextPolicyId() public {
        assertEq(manager.previewNextPolicyId(alice, address(weth)), _expectedPolicyId(alice, address(weth), 0));
        vm.prank(alice);
        manager.setGuardianPolicy(address(weth), 0, 100, 0, 1 ether, 50);
        assertEq(manager.previewNextPolicyId(alice, address(weth)), _expectedPolicyId(alice, address(weth), 1));
    }

    function test_getOwnerPolicyIds_pagination() public {
        vm.startPrank(alice);
        manager.setGuardianPolicy(address(weth), 0, 100, 0, 1 ether, 50);
        manager.setGuardianPolicy(address(weth), 0, 200, 0, 2 ether, 100);
        vm.stopPrank();

        bytes32[] memory page = manager.getOwnerPolicyIds(alice, 0, 1);
        assertEq(page.length, 1);
        assertEq(page[0], _expectedPolicyId(alice, address(weth), 0));
        bytes32[] memory rest = manager.getOwnerPolicyIds(alice, 1, 10);
        assertEq(rest.length, 1);
        assertEq(rest[0], _expectedPolicyId(alice, address(weth), 1));
    }

    function test_revokePolicy() public {
        vm.prank(alice);
        manager.setGuardianPolicy(address(weth), 0, 100, 0, 1 ether, 50);
        bytes32 policyId = _expectedPolicyId(alice, address(weth), 0);
        vm.prank(alice);
        manager.revokePolicy(policyId);
        (, , bool active, , , , , ) = manager.policies(policyId);
        assertFalse(active);
    }

    function test_killSwitch_revokesAll_andKillsSession() public {
        vm.startPrank(alice);
        manager.setGuardianPolicy(address(weth), 0, 100, 0, 1 ether, 50);
        manager.setGuardianPolicy(address(weth), 1, 0, 4000e8, 1 ether, 50);
        validator.setSessionKey(keeper, true);
        manager.killSwitch();
        vm.stopPrank();

        (, , bool a0, , , , , ) = manager.policies(_expectedPolicyId(alice, address(weth), 0));
        (, , bool a1, , , , , ) = manager.policies(_expectedPolicyId(alice, address(weth), 1));
        assertFalse(a0);
        assertFalse(a1);
        assertTrue(validator.killed(alice));
        assertFalse(validator.isSessionKey(alice, keeper));
    }

    function test_reverts_zeroStopLoss() public {
        vm.prank(alice);
        vm.expectRevert(bytes("zero stop loss"));
        manager.setGuardianPolicy(address(weth), 0, 0, 0, 1 ether, 50);
    }

    function test_reverts_zeroTakeProfit() public {
        vm.prank(alice);
        vm.expectRevert(bytes("zero take profit"));
        manager.setGuardianPolicy(address(weth), 1, 0, 0, 1 ether, 50);
    }

    function test_reverts_zeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(bytes("zero amount"));
        manager.setGuardianPolicy(address(weth), 0, 100, 0, 0, 50);
    }

    function test_reverts_maxSlippage() public {
        vm.prank(alice);
        vm.expectRevert(bytes("invalid slippage"));
        manager.setGuardianPolicy(address(weth), 0, 100, 0, 1 ether, 10_000);
    }

    function test_executePolicy_stopLoss_emitsReceipt() public {
        uint256 amountIn = 1 ether;
        vm.prank(alice);
        manager.setGuardianPolicy(address(weth), 0, 3000e8, 0, amountIn, 50);

        weth.mint(alice, amountIn);
        vm.prank(alice);
        weth.approve(address(manager), amountIn);
        vm.prank(alice);
        validator.setSessionKey(keeper, true);

        pyth.setPrice(2800e8, -8);
        bytes[] memory update = new bytes[](1);
        update[0] = hex"00";

        bytes32 policyId = _expectedPolicyId(alice, address(weth), 0);
        vm.prank(keeper);
        manager.executePolicy(policyId, update);

        (, , bool active, , , , , ) = manager.policies(policyId);
        assertFalse(active);
        assertEq(manager.totalReceipts(), 1);
    }

    function test_executePolicy_notTriggered() public {
        vm.prank(alice);
        manager.setGuardianPolicy(address(weth), 0, 2000e8, 0, 1 ether, 50);
        weth.mint(alice, 1 ether);
        vm.prank(alice);
        weth.approve(address(manager), 1 ether);

        pyth.setPrice(2800e8, -8);
        bytes[] memory update = new bytes[](1);
        update[0] = hex"00";

        vm.prank(alice);
        vm.expectRevert(bytes("not triggered"));
        manager.executePolicy(_expectedPolicyId(alice, address(weth), 0), update);
    }

    function test_executePolicy_rejectsUnknownKeeper() public {
        vm.prank(alice);
        manager.setGuardianPolicy(address(weth), 0, 3000e8, 0, 1 ether, 50);
        bytes[] memory update = new bytes[](1);
        vm.prank(keeper);
        vm.expectRevert(bytes("not session"));
        manager.executePolicy(_expectedPolicyId(alice, address(weth), 0), update);
    }
}
