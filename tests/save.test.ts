/**
 * Save-state helper tests.
 *
 * Unlike the per-game tests (which mirror logic), these import the REAL
 * source module so coverage is genuine.
 *
 * Run: npx tsx tests/save.test.ts
 */
import assert from "node:assert/strict";
import { test, summary, banner } from "./helpers.js";
import {
	isResumable,
	isValidBoard,
	isValidSquareBoard,
} from "../extensions/games/save.js";

banner("💾 Save-state helper tests");

// ─── isResumable ────────────────────────────────────────────────────

test("gameOver=true is not resumable", () => {
	assert.equal(isResumable({ gameOver: true }), false);
});

test("gameOver=false is resumable", () => {
	assert.equal(isResumable({ gameOver: false }), true);
});

test("status 'playing' is resumable", () => {
	assert.equal(isResumable({ status: "playing" }), true);
});

test("status 'win_1' / 'win_2' / 'draw' are NOT resumable", () => {
	assert.equal(isResumable({ status: "win_1" }), false);
	assert.equal(isResumable({ status: "win_2" }), false);
	assert.equal(isResumable({ status: "draw" }), false);
});

test("phase 'placing' / 'playing' are resumable", () => {
	assert.equal(isResumable({ phase: "placing" }), true);
	assert.equal(isResumable({ phase: "playing" }), true);
});

test("phase 'won' / 'lost' / 'done' are NOT resumable", () => {
	assert.equal(isResumable({ phase: "won" }), false);
	assert.equal(isResumable({ phase: "lost" }), false);
	assert.equal(isResumable({ phase: "done" }), false);
});

test("null / undefined / primitives are not resumable", () => {
	assert.equal(isResumable(null), false);
	assert.equal(isResumable(undefined), false);
	assert.equal(isResumable("snake-save"), false);
	assert.equal(isResumable(42), false);
});

test("unrecognised shape is not resumable (no false 💾)", () => {
	// e.g. a highscore-only entry { bestWpm: 50 }
	assert.equal(isResumable({ bestWpm: 50 }), false);
});

test("resumable games with gameOver flag still honour it over status", () => {
	// fifteen/lightsout/sudoku only have gameOver — ensure no status field
	// accidentally flips the result
	assert.equal(isResumable({ gameOver: false, board: [[1, 2]] }), true);
	assert.equal(isResumable({ gameOver: true, board: [[1, 2]] }), false);
});

// ─── isValidBoard ──────────────────────────────────────────────────

test("valid rectangular board", () => {
	assert.equal(
		isValidBoard(
			[
				[0, 1, 2],
				[3, 4, 5],
			],
			2,
			3,
		),
		true,
	);
});

test("wrong row count rejected", () => {
	assert.equal(isValidBoard([[0, 1]], 2, 2), false);
});

test("wrong col count rejected", () => {
	assert.equal(
		isValidBoard(
			[
				[0, 1],
				[2, 3],
			],
			2,
			3,
		),
		false);
});

test("non-array rejected", () => {
	assert.equal(isValidBoard("nope", 2, 2), false);
	assert.equal(isValidBoard(null, 2, 2), false);
	assert.equal(isValidBoard([1, 2], 2, 2), false); // 1-D
});

test("isValidSquareBoard", () => {
	assert.equal(isValidSquareBoard([[1, 2], [3, 4]], 2), true);
	assert.equal(isValidSquareBoard([[1, 2], [3, 4]], 3), false);
});

if (!summary()) process.exit(1);
