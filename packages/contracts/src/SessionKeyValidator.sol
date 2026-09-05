// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SessionKeyValidator — keeper keys, killed with the owner kill switch
/// @dev ERC-7579 IValidator-shaped; GPM checks isSessionKey before executePolicy.
contract SessionKeyValidator {
    address public manager;

    mapping(address => mapping(address => bool)) public keys;
    mapping(address => bool) public killed;

    event ManagerSet(address indexed manager);
    event SessionKeySet(address indexed owner, address indexed key, bool allowed);
    event SessionKilled(address indexed owner);

    modifier onlyManager() {
        require(msg.sender == manager, "not manager");
        _;
    }

    function setManager(address _manager) external {
        require(manager == address(0), "already set");
        require(_manager != address(0), "zero addr");
        manager = _manager;
        emit ManagerSet(_manager);
    }

    function setSessionKey(address key, bool allowed) external {
        require(!killed[msg.sender], "killed");
        require(key != address(0), "zero key");
        keys[msg.sender][key] = allowed;
        emit SessionKeySet(msg.sender, key, allowed);
    }

    function kill(address owner) external onlyManager {
        killed[owner] = true;
        emit SessionKilled(owner);
    }

    function isSessionKey(address owner, address key) external view returns (bool) {
        if (killed[owner]) return false;
        if (key == owner) return true;
        return keys[owner][key];
    }
}
