// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {GuardianPolicyManager} from "../src/GuardianPolicyManager.sol";
import {SwapExecutor} from "../src/SwapExecutor.sol";
import {SessionKeyValidator} from "../src/SessionKeyValidator.sol";

contract Deploy is Script {
    address constant PYTH = 0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a;
    address constant SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant CBETH = 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22;
    bytes32 constant ETH_USD = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 constant USDC_USD = 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a;

    function run() external returns (GuardianPolicyManager manager, SwapExecutor executor, SessionKeyValidator validator) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        executor = new SwapExecutor(SWAP_ROUTER, USDC, WETH);
        manager = new GuardianPolicyManager(PYTH, address(executor), WETH, ETH_USD, USDC, USDC_USD);
        manager.setPriceFeed(CBETH, ETH_USD);

        validator = new SessionKeyValidator();
        manager.setValidator(address(validator));
        validator.setManager(address(manager));

        console2.log("SwapExecutor", address(executor));
        console2.log("GuardianPolicyManager", address(manager));
        console2.log("SessionKeyValidator", address(validator));

        vm.stopBroadcast();
    }
}
