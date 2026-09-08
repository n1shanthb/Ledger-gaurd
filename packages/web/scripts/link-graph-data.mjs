import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const linkPath = join(webRoot, "src", "vendor", "graph-data");
const target = join(webRoot, "..", "graph-data", "src");

mkdirSync(dirname(linkPath), { recursive: true });
if (existsSync(linkPath)) {
  try {
    rmSync(linkPath, { recursive: true, force: true });
  } catch {
    /* junction remove on win sometimes needs cmd */
    try {
      execSync(`cmd /c rmdir "${linkPath}"`, { stdio: "ignore" });
    } catch {
      /* ignore */
    }
  }
}

if (process.platform === "win32") {
  execSync(`cmd /c mklink /J "${linkPath}" "${target}"`, { stdio: "inherit" });
} else {
  execSync(`ln -s "${target}" "${linkPath}"`, { stdio: "inherit" });
}

console.log("[lga] linked", linkPath, "→", target);
