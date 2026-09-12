/** @deprecated Phase A — Oracle merged into Market Solver. */
export async function runOracle(): Promise<string> {
  throw new Error("runOracle removed — use runSolver + ensureSolverGate (Phase A)");
}
