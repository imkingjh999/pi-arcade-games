/**
 * Run all game logic tests.
 * This is the entry point for `npm test`.
 * Run: npx tsx tests/run-all.ts
 */
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

const dir = path.dirname(import.meta.url.replace("file://", ""));
const files = fs
	.readdirSync(dir)
	.filter((f) => f.endsWith(".test.ts") && f !== "run-all.ts")
	.sort();

let totalPassed = 0;
let totalFailed = 0;
const failures: string[] = [];

for (const file of files) {
	try {
		const out = execSync(`npx tsx ${path.join(dir, file)}`, {
			encoding: "utf-8",
			timeout: 30_000,
			stdio: ["pipe", "pipe", "pipe"],
		});
		// Parse summary line
		const match = out.match(/Total: (\d+) — (\d+) ✅ passed, (\d+) ❌ failed/);
		if (match) {
			totalPassed += parseInt(match[2]);
			totalFailed += parseInt(match[3]);
		}
		if (out.includes("❌")) {
			// Extract failed test names
			for (const line of out.split("\n")) {
				if (line.includes("❌") && !line.includes("Total:")) {
					failures.push(`${file}: ${line.trim()}`);
				}
			}
		}
	} catch (e: any) {
		const out = e.stdout ?? "";
		const match = out.match(/Total: (\d+) — (\d+) ✅ passed, (\d+) ❌ failed/);
		if (match) {
			totalPassed += parseInt(match[2]);
			totalFailed += parseInt(match[3]);
		}
		for (const line of (out + "\n" + (e.stderr ?? "")).split("\n")) {
			if (line.includes("❌") && !line.includes("Total:")) {
				failures.push(`${file}: ${line.trim()}`);
			}
		}
	}
}

console.log(
	"\n╔══════════════════════════════════════════════════════════════╗",
);
console.log("║           ALL TESTS — FINAL SUMMARY                        ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log(`\nFiles: ${files.length} test suites`);
console.log(
	`Total: ${totalPassed + totalFailed} — ${totalPassed} ✅ passed, ${totalFailed} ❌ failed`,
);

if (failures.length > 0) {
	console.log("\nFailed tests:");
	failures.forEach((f) => console.log(`  ${f}`));
	process.exit(1);
} else {
	console.log("\n🎉 All tests across all games passed!");
}
