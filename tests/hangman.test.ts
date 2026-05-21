/**
 * Hangman game logic tests.
 *
 * Tests wrong count, game over (6 wrong), win condition,
 * duplicate guess, case insensitivity extracted from source.
 *
 * Run: npx tsx tests/hangman.test.ts
 */

import assert from "node:assert/strict";
import { test, summary, banner, reset } from "./helpers.js";

// ─── Extract game logic (mirrors hangman.ts exactly) ────────────────

interface GameState {
	word: string;
	category: string;
	guessed: string[];
	wrongCount: number;
	gameOver: boolean;
	won: boolean;
}

function simulateGuess(state: GameState, letter: string): void {
	letter = letter.toLowerCase();
	// Source: if (/^[a-z]$/.test(letter) && !state.guessed.includes(letter))
	if (!/^[a-z]$/.test(letter)) return;
	if (state.guessed.includes(letter)) return;

	state.guessed.push(letter);
	if (!state.word.includes(letter)) state.wrongCount++;
	if (state.wrongCount >= 6) {
		state.gameOver = true;
		state.won = false;
	} else if ([...state.word].every((c) => state.guessed.includes(c))) {
		state.gameOver = true;
		state.won = true;
	}
}

function createTestState(word: string): GameState {
	return {
		word,
		category: "Test",
		guessed: [],
		wrongCount: 0,
		gameOver: false,
		won: false,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

banner("Hangman Logic Tests");

// ─── 1. Wrong count increments on wrong letter ──────────────────────

console.log("\n⚠️ Wrong count increment tests\n");

test("wrong guess increments wrongCount", () => {
	const state = createTestState("hello");
	simulateGuess(state, "z");
	assert.equal(state.wrongCount, 1);
	assert.equal(state.gameOver, false);
});

test("two wrong guesses increment wrongCount to 2", () => {
	const state = createTestState("hello");
	simulateGuess(state, "z");
	simulateGuess(state, "x");
	assert.equal(state.wrongCount, 2);
	assert.equal(state.gameOver, false);
});

test("correct guess does not increment wrongCount", () => {
	const state = createTestState("hello");
	simulateGuess(state, "h");
	assert.equal(state.wrongCount, 0);
	assert.equal(state.gameOver, false);
	assert.ok(state.guessed.includes("h"));
});

// ─── 2. 6 wrong = game over (lost) ─────────────────────────────────

console.log("\n💀 Game over at 6 wrong tests\n");

test("6 wrong guesses = game over, lost", () => {
	const state = createTestState("hello");
	simulateGuess(state, "z"); // 1
	simulateGuess(state, "x"); // 2
	simulateGuess(state, "q"); // 3
	simulateGuess(state, "v"); // 4
	simulateGuess(state, "b"); // 5
	assert.equal(state.gameOver, false); // not yet
	simulateGuess(state, "n"); // 6
	assert.equal(state.wrongCount, 6);
	assert.equal(state.gameOver, true);
	assert.equal(state.won, false);
});

test("5 wrong guesses = not yet game over", () => {
	const state = createTestState("hello");
	simulateGuess(state, "z"); // 1
	simulateGuess(state, "x"); // 2
	simulateGuess(state, "q"); // 3
	simulateGuess(state, "v"); // 4
	simulateGuess(state, "b"); // 5
	assert.equal(state.wrongCount, 5);
	assert.equal(state.gameOver, false);
});

// ─── 3. All letters guessed = win ───────────────────────────────────

console.log("\n🏆 Win condition tests\n");

test("all letters guessed = win", () => {
	const state = createTestState("cat");
	simulateGuess(state, "c");
	assert.equal(state.gameOver, false);
	simulateGuess(state, "a");
	assert.equal(state.gameOver, false);
	simulateGuess(state, "t");
	assert.equal(state.gameOver, true);
	assert.equal(state.won, true);
	assert.equal(state.wrongCount, 0);
});

test("all letters guessed with some wrongs = still win", () => {
	const state = createTestState("cat");
	simulateGuess(state, "z"); // wrong
	simulateGuess(state, "c");
	simulateGuess(state, "a");
	simulateGuess(state, "t");
	assert.equal(state.gameOver, true);
	assert.equal(state.won, true);
	assert.equal(state.wrongCount, 1);
});

test("word with repeated letters: guess once covers all", () => {
	const state = createTestState("hello");
	simulateGuess(state, "h");
	simulateGuess(state, "e");
	simulateGuess(state, "l"); // covers both l's
	simulateGuess(state, "o");
	assert.equal(state.gameOver, true);
	assert.equal(state.won, true);
	assert.equal(state.wrongCount, 0);
});

// ─── 4. Duplicate guess ignored ─────────────────────────────────────

console.log("\n🔁 Duplicate guess tests\n");

test("duplicate guess is ignored (not added again)", () => {
	const state = createTestState("hello");
	simulateGuess(state, "z");
	assert.equal(state.wrongCount, 1);
	assert.equal(state.guessed.length, 1);
	simulateGuess(state, "z"); // duplicate
	assert.equal(state.wrongCount, 1); // no increment
	assert.equal(state.guessed.length, 1); // not added again
});

test("duplicate correct guess is ignored", () => {
	const state = createTestState("hello");
	simulateGuess(state, "h");
	assert.equal(state.guessed.length, 1);
	simulateGuess(state, "h"); // duplicate
	assert.equal(state.guessed.length, 1);
});

// ─── 5. Case insensitive ───────────────────────────────────────────

console.log("\n🔤 Case insensitivity tests\n");

test("uppercase letter is accepted (lowercased)", () => {
	const state = createTestState("hello");
	simulateGuess(state, "H"); // uppercase
	assert.ok(state.guessed.includes("h"));
	assert.equal(state.wrongCount, 0);
});

test("uppercase wrong letter counts as wrong", () => {
	const state = createTestState("hello");
	simulateGuess(state, "Z"); // uppercase wrong
	assert.ok(state.guessed.includes("z"));
	assert.equal(state.wrongCount, 1);
});

test("mixed case guess is lowercased", () => {
	const state = createTestState("hello");
	simulateGuess(state, "H");
	simulateGuess(state, "E");
	simulateGuess(state, "L");
	simulateGuess(state, "O");
	assert.equal(state.gameOver, true);
	assert.equal(state.won, true);
	assert.deepEqual(state.guessed, ["h", "e", "l", "o"]);
});

if (!summary()) process.exit(1);
