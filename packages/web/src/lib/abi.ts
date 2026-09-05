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
] as const;

export const BASE_TOKENS = {
  WETH: "0x4200000000000000000000000000000000000006",
  CBBTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
} as const;

export function tokenDecimals(token: string): number {
  const t = token.toLowerCase();
  if (t === BASE_TOKENS.USDC.toLowerCase()) return 6;
  if (t === BASE_TOKENS.CBBTC.toLowerCase()) return 8;
  return 18;
}
