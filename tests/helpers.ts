/**
 * Shared test utilities for all game tests.
 */

let _passed = 0;
let _failed = 0;
const _failures: string[] = [];

export function reset() {
	_passed = 0;
	_failed = 0;
	_failures.length = 0;
}

export function test(name: string, fn: () => void) {
	try {
		fn();
		_passed++;
		console.log(`  ✅ ${name}`);
	} catch (e: any) {
		_failed++;
		const msg = e?.message ?? String(e);
		_failures.push(name);
		console.log(`  ❌ ${name}`);
		console.log(`     ${msg}`);
	}
}

export function summary() {
	console.log(`\n════════════════════════════════════════════════════`);
	console.log(
		`Total: ${_passed + _failed} — ${_passed} ✅ passed, ${_failed} ❌ failed`,
	);
	if (_failed > 0) {
		console.log("\nFailed:");
		_failures.forEach((f) => console.log(`  ❌ ${f}`));
		return false;
	}
	return true;
}

export function banner(title: string) {
	console.log(`\n${"═".repeat(52)}`);
	console.log(`  ${title}`);
	console.log(`${"═".repeat(52)}\n`);
}
