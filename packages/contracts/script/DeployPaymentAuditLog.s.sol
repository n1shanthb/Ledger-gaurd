// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PaymentAuditLog} from "../src/PaymentAuditLog.sol";

contract DeployPaymentAuditLog is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        PaymentAuditLog log = new PaymentAuditLog();
        console2.log("PaymentAuditLog", address(log));
        vm.stopBroadcast();
    }
}
