export const guardianPolicyManagerAbi = [
  {
    type: "function",
    name: "setGuardianPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "policyType", type: "uint8" },
      { name: "stopLossPrice", type: "uint256" },
      { name: "takeProfitPrice", type: "uint256" },
      { name: "maxAmount", type: "uint256" },
      { name: "maxSlippageBps", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "killSwitch",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "event",
    name: "PolicyCreated",
    inputs: [
      { name: "policyId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "policyType", type: "uint8", indexed: false },
      { name: "stopLossPrice", type: "uint256", indexed: false },
      { name: "takeProfitPrice", type: "uint256", indexed: false },
      { name: "maxAmount", type: "uint256", indexed: false },
      { name: "maxSlippageBps", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "KillSwitchActivated",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "policiesRevoked", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export const BASE_TOKENS = {
  WETH: "0x4200000000000000000000000000000000000006",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
} as const;
