// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {GuardianPolicyManager} from "../src/GuardianPolicyManager.sol";
import {SessionKeyValidator} from "../src/SessionKeyValidator.sol";

/// @notice Redeploy GPM with BUY_DIP; reuse live SwapExecutor on Base.
contract DeployBuyDip is Script {
    address constant PYTH = 0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a;
    address constant EXECUTOR = 0x4767a9Deee297d73B72cDD850850D11B221034Ab;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant CBETH = 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22;
    address constant CBBTC = 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf;
    bytes32 constant ETH_USD = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 constant BTC_USD = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    bytes32 constant USDC_USD = 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a;

    function run() external returns (GuardianPolicyManager manager, SessionKeyValidator validator) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        manager = new GuardianPolicyManager(PYTH, EXECUTOR, WETH, ETH_USD, USDC, USDC_USD);
        manager.setPriceFeed(CBETH, ETH_USD);
        manager.setPriceFeed(CBBTC, BTC_USD);

        validator = new SessionKeyValidator();
        manager.setValidator(address(validator));
        validator.setManager(address(manager));

        console2.log("GuardianPolicyManager", address(manager));
        console2.log("SessionKeyValidator", address(validator));
        console2.log("SwapExecutor (reused)", EXECUTOR);

        vm.stopBroadcast();
    }
}
