import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { toBaseUnits } from "../src/lib/api/task-types";

test("task boundary rejects spending routes and preserves exact amounts", () => {
  expect(toBaseUnits("60")).toBe("60000000");
  expect(toBaseUnits("9007199254740993.000001")).toBe("9007199254740993000001");
  for (const input of ["0", "-1", "1e3", "1.0000001", "01"]) expect(() => toBaseUnits(input)).toThrow();
  expect(execFileSync(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "tests/task-proxy.mjs"], { encoding: "utf8", timeout: 30000 })).toContain("checks passed");
});
