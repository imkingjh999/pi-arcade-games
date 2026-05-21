/**
 * Wordle game logic tests.
 *
 * Tests evaluate() function (exact match, no match, duplicate letters,
 * letter pooling, input overflow) extracted from source.
 *
 * Run: npx tsx tests/wordle.test.ts
 */

import assert from "node:assert/strict";
import { test, summary, banner, reset } from "./helpers.js";

// ─── Extract game logic (mirrors wordle.ts exactly) ─────────────────

interface GuessResult {
	letter: string;
	status: "correct" | "present" | "absent";
}

function evaluate(guess: string, answer: string): GuessResult[] {
	const result: GuessResult[] = guess
		.split("")
		.map((l) => ({ letter: l, status: "absent" as const }));
	const ansArr = answer.split("");
	// First pass: correct positions
	for (let i = 0; i < 5; i++) {
		if (guess[i] === answer[i]) {
			result[i].status = "correct";
			ansArr[i] = "";
		}
	}
	// Second pass: present but wrong position
	for (let i = 0; i < 5; i++) {
		if (result[i].status === "correct") continue;
		const idx = ansArr.indexOf(guess[i]);
		if (idx !== -1) {
			result[i].status = "present";
			ansArr[idx] = "";
		}
	}
	return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

banner("Wordle Logic Tests");

// ─── 1. Exact match all correct ─────────────────────────────────────

console.log("\n✅ Exact match tests\n");

test("exact match: all 5 letters correct", () => {
	const result = evaluate("apple", "apple");
	for (let i = 0; i < 5; i++)
		assert.equal(result[i].status, "correct", `Letter ${i} should be correct`);
});

test("exact match: different word, all correct", () => {
	const result = evaluate("stone", "stone");
	for (let i = 0; i < 5; i++)
		assert.equal(result[i].status, "correct");
});

// ─── 2. No match all absent ─────────────────────────────────────────

console.log("\n🔍 No match tests\n");

test("no match: all letters absent", () => {
	const result = evaluate("xyzzy", "apple");
	// x, y, z are not in "apple"
	assert.equal(result[0].status, "absent"); // x
	assert.equal(result[1].status, "absent"); // y
	assert.equal(result[2].status, "absent"); // z
	assert.equal(result[3].status, "absent"); // z
	assert.equal(result[4].status, "absent"); // y
});

// ─── 3. Duplicate letters: "eerie" vs "eager" ──────────────────────

console.log("\n🔁 Duplicate letters tests\n");

test('"eerie" vs "eager": exact handling', () => {
	// answer: eager  →  e, a, g, e, r
	// guess:  eerie  →  e, e, r, i, e
	const result = evaluate("eerie", "eager");

	// First pass (correct positions):
	//   e vs e → correct (pos 0)
	//   e vs a → no
	//   r vs g → no
	//   i vs e → no
	//   e vs r → no
	// ansArr after first pass: ["", "a", "g", "e", "r"]

	// Second pass:
	//   pos 1: e → found at index 3 in ansArr → present, ansArr[3]=""
	//   pos 2: r → found at index 4 in ansArr → present, ansArr[4]=""
	//   pos 3: i → not found → absent
	//   pos 4: e → not found (only "a","g" left) → absent

	assert.equal(result[0].status, "correct"); // e at pos 0
	assert.equal(result[1].status, "present");  // e not at pos 1 but in answer
	assert.equal(result[2].status, "present");  // r not at pos 2 but in answer
	assert.equal(result[3].status, "absent");   // i not in answer
	assert.equal(result[4].status, "absent");   // e: both e's already used
});

// ─── 4. Letter appears once, guessed twice ──────────────────────────

console.log("\n🔤 Single letter, double guess tests\n");

test("letter appears once in answer, guessed twice: only first is present", () => {
	// answer: "stone" (s, t, o, n, e) — 'o' appears once
	// guess:  "robot" (r, o, b, o, t) — 'o' appears twice
	const result = evaluate("robot", "stone");

	assert.equal(result[0].status, "absent");  // r not in stone
	assert.equal(result[1].status, "present");  // o not at pos 1 but in answer
	assert.equal(result[2].status, "absent");  // b not in stone
	assert.equal(result[3].status, "absent");  // o: already used (only 1 'o' in answer)
	assert.equal(result[4].status, "present");  // t not at pos 4 but in answer
});

test("letter appears once, one is correct, other is absent", () => {
	// answer: "ocean" — 'o' at pos 0
	// guess:  "ghost" — 'o' at pos 2, no other o
	const result = evaluate("ghost", "ocean");

	assert.equal(result[0].status, "absent");  // g not in ocean
	assert.equal(result[1].status, "absent");  // h not in ocean
	assert.equal(result[2].status, "present");  // o at wrong position but in answer
	assert.equal(result[3].status, "absent");  // s not in ocean
	assert.equal(result[4].status, "absent");  // t not in ocean
});

// ─── 5. Second pass removes used letters from answer pool ───────────

console.log("\n🔄 Second pass letter removal tests\n");

test("after first pass marks correct, those letters can't be reused", () => {
	// answer: "aabbb" — a at 0,1; b at 2,3,4
	// guess:  "bbbaa"
	const result = evaluate("bbbaa", "aabbb");

	// First pass: check exact matches
	//   b vs a → no
	//   b vs a → no
	//   b vs b → correct (pos 2)
	//   a vs b → no
	//   a vs b → no
	// ansArr after: ["a", "a", "", "b", "b"]

	// Second pass:
	//   pos 0: b → found at index 3 → present, ansArr[3]=""
	//   pos 1: b → found at index 4 → present, ansArr[4]=""
	//   pos 3: a → found at index 0 → present, ansArr[0]=""
	//   pos 4: a → found at index 1 → present, ansArr[1]=""

	assert.equal(result[0].status, "present"); // b
	assert.equal(result[1].status, "present"); // b
	assert.equal(result[2].status, "correct"); // b
	assert.equal(result[3].status, "present"); // a
	assert.equal(result[4].status, "present"); // a
});

test("triple letter in guess, single in answer: only one present", () => {
	// answer: "stare" — one 'e' at pos 4
	// guess:  "eeeez"
	const result = evaluate("eeeez", "stare");

	// First pass: e vs s→no, e vs t→no, e vs a→no, e vs r→no, z vs e→no
	// ansArr: ["s","t","a","r","e"]
	// Second pass:
	//   pos 0: e → found at index 4 → present, ansArr[4]=""
	//   pos 1: e → not found → absent
	//   pos 2: e → not found → absent
	//   pos 3: e → not found → absent
	//   pos 4: z → not found → absent

	assert.equal(result[0].status, "present"); // e
	assert.equal(result[1].status, "absent");  // e (already used)
	assert.equal(result[2].status, "absent");  // e (already used)
	assert.equal(result[3].status, "absent");  // e (already used)
	assert.equal(result[4].status, "absent");  // z
});

// ─── 6. 5-letter input only ─────────────────────────────────────────

console.log("\n📏 Input validation tests\n");

test("evaluate works with exactly 5 letters", () => {
	const result = evaluate("hello", "world");
	assert.equal(result.length, 5);
});

test("input overflow: source restricts to 5 chars (simulated)", () => {
	// In the source: if (letter.length < 5) — input restricted
	// Simulate the input handler logic
	let currentInput = "hell";
	const letter = "o";
	if (/^[a-z]$/.test(letter) && currentInput.length < 5) {
		currentInput += letter;
	}
	assert.equal(currentInput, "hello");

	// Try adding 6th
	const extra = "x";
	if (/^[a-z]$/.test(extra) && currentInput.length < 5) {
		currentInput += extra;
	}
	assert.equal(currentInput, "hello"); // stays 5
});

test("backspace removes last character (simulated)", () => {
	let currentInput = "hello";
	currentInput = currentInput.slice(0, -1);
	assert.equal(currentInput, "hell");
});

if (!summary()) process.exit(1);
