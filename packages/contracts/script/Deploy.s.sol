// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {GuardianPolicyManager} from "../src/GuardianPolicyManager.sol";

contract Deploy is Script {
    function run() external returns (GuardianPolicyManager manager) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        manager = new GuardianPolicyManager();
        console2.log("GuardianPolicyManager deployed at:", address(manager));

        vm.stopBroadcast();
    }
}
