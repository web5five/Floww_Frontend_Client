import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test("server proxy contract and credential isolation", () => {
  const output = execFileSync(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "tests/proxy-harness.mjs"], { encoding: "utf8", timeout: 30_000 });
  expect(output).toContain("checks passed");
});
