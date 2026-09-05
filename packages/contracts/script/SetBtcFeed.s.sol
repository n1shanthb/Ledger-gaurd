// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {GuardianPolicyManager} from "../src/GuardianPolicyManager.sol";

/// @notice Register Pyth BTC/USD for cbBTC on an existing GPM (no redeploy).
contract SetBtcFeed is Script {
    address constant CBBTC = 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf;
    bytes32 constant BTC_USD = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;

    function run() external {
        address gpm = vm.envAddress("GUARDIAN_POLICY_MANAGER");
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(key);
        GuardianPolicyManager(gpm).setPriceFeed(CBBTC, BTC_USD);
        vm.stopBroadcast();
        console2.log("setPriceFeed cbBTC on", gpm);
    }
}
