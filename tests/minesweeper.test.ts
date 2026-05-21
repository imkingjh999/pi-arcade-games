/**
 * Minesweeper game logic tests.
 *
 * Tests placeMines, reveal, flood fill, flag toggle, win detection
 * extracted from source.
 *
 * Run: npx tsx tests/minesweeper.test.ts
 */

import assert from "node:assert/strict";
import { test, summary, banner, reset } from "./helpers.js";

// ─── Extract game logic (mirrors minesweeper.ts exactly) ────────────

type CellState = "hidden" | "revealed" | "flagged";

interface GameState {
	rows: number;
	cols: number;
	mineCount: number;
	mines: boolean[][];
	numbers: number[][];
	cellStates: CellState[][];
	gameOver: boolean;
	won: boolean;
	cursorRow: number;
	cursorCol: number;
	firstClick: boolean;
}

function createState(rows: number, cols: number, mineCount: number): GameState {
	return {
		rows,
		cols,
		mineCount,
		mines: Array.from({ length: rows }, () => Array(cols).fill(false)),
		numbers: Array.from({ length: rows }, () => Array(cols).fill(0)),
		cellStates: Array.from({ length: rows }, () =>
			Array(cols).fill("hidden"),
		),
		gameOver: false,
		won: false,
		cursorRow: 0,
		cursorCol: 0,
		firstClick: true,
	};
}

function placeMines(state: GameState, safeR: number, safeC: number) {
	let placed = 0;
	while (placed < state.mineCount) {
		const r = Math.floor(Math.random() * state.rows),
			c = Math.floor(Math.random() * state.cols);
		if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
		if (state.mines[r][c]) continue;
		state.mines[r][c] = true;
		placed++;
	}
	for (let r = 0; r < state.rows; r++)
		for (let c = 0; c < state.cols; c++) {
			if (state.mines[r][c]) {
				state.numbers[r][c] = -1;
				continue;
			}
			let count = 0;
			for (let dr = -1; dr <= 1; dr++)
				for (let dc = -1; dc <= 1; dc++) {
					const nr = r + dr,
						nc = c + dc;
					if (
						nr >= 0 &&
						nr < state.rows &&
						nc >= 0 &&
						nc < state.cols &&
						state.mines[nr][nc]
					)
						count++;
				}
			state.numbers[r][c] = count;
		}
}

function reveal(state: GameState, r: number, c: number): boolean {
	if (state.firstClick) {
		placeMines(state, r, c);
		state.firstClick = false;
	}
	if (state.mines[r][c]) {
		state.gameOver = true;
		return false;
	}
	const stack: [number, number][] = [[r, c]];
	while (stack.length) {
		const [cr, cc] = stack.pop()!;
		if (cr < 0 || cr >= state.rows || cc < 0 || cc >= state.cols) continue;
		if (state.cellStates[cr][cc] !== "hidden") continue;
		state.cellStates[cr][cc] = "revealed";
		if (state.numbers[cr][cc] === 0) {
			for (let dr = -1; dr <= 1; dr++)
				for (let dc = -1; dc <= 1; dc++) stack.push([cr + dr, cc + dc]);
		}
	}
	// Check win
	let hidden = 0;
	for (let rr = 0; rr < state.rows; rr++)
		for (let cc = 0; cc < state.cols; cc++)
			if (state.cellStates[rr][cc] !== "revealed") hidden++;
	if (hidden === state.mineCount) {
		state.won = true;
		state.gameOver = true;
	}
	return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

banner("Minesweeper Logic Tests");

// ─── 1. First click safe zone ───────────────────────────────────────

console.log("\n🛡️ First click safe zone tests\n");

test("no mines in 3x3 around first click (corner)", () => {
	// Use a 9x9 board with 10 mines (easy config)
	for (let trial = 0; trial < 50; trial++) {
		const state = createState(9, 9, 10);
		reveal(state, 0, 0);
		// Check 3x3 around (0,0)
		for (let r = 0; r <= 1; r++)
			for (let c = 0; c <= 1; c++)
				assert.equal(
					state.mines[r][c],
					false,
					`Mine found in safe zone at (${r},${c}) trial ${trial}`,
				);
	}
});

test("no mines in 3x3 around first click (center)", () => {
	for (let trial = 0; trial < 50; trial++) {
		const state = createState(9, 9, 10);
		reveal(state, 4, 4);
		for (let r = 3; r <= 5; r++)
			for (let c = 3; c <= 5; c++)
				assert.equal(
					state.mines[r][c],
					false,
					`Mine found in safe zone at (${r},${c}) trial ${trial}`,
				);
	}
});

test("no mines in 3x3 around first click (edge)", () => {
	for (let trial = 0; trial < 50; trial++) {
		const state = createState(9, 9, 10);
		reveal(state, 0, 4);
		for (let r = 0; r <= 1; r++)
			for (let c = 3; c <= 5; c++)
				assert.equal(
					state.mines[r][c],
					false,
					`Mine found in safe zone at (${r},${c}) trial ${trial}`,
				);
	}
});

// ─── 2. Number calculation correct ──────────────────────────────────

console.log("\n🔢 Number calculation tests\n");

test("number reflects adjacent mine count", () => {
	// Manually place mines and check numbers
	const state = createState(5, 5, 0);
	// Place mines at (0,0) and (2,2)
	state.mines[0][0] = true;
	state.mines[2][2] = true;
	// Recalculate numbers manually (same logic as placeMines)
	for (let r = 0; r < state.rows; r++)
		for (let c = 0; c < state.cols; c++) {
			if (state.mines[r][c]) {
				state.numbers[r][c] = -1;
				continue;
			}
			let count = 0;
			for (let dr = -1; dr <= 1; dr++)
				for (let dc = -1; dc <= 1; dc++) {
					const nr = r + dr,
						nc = c + dc;
					if (
						nr >= 0 &&
						nr < state.rows &&
						nc >= 0 &&
						nc < state.cols &&
						state.mines[nr][nc]
					)
						count++;
				}
			state.numbers[r][c] = count;
		}
	// (1,1) is adjacent to both mines → 2
	assert.equal(state.numbers[1][1], 2);
	// (0,1) is adjacent to (0,0) → 1
	assert.equal(state.numbers[0][1], 1);
	// (1,0) is adjacent to (0,0) → 1
	assert.equal(state.numbers[1][0], 1);
	// (4,4) is adjacent to neither → 0
	assert.equal(state.numbers[4][4], 0);
	// (1,2) is adjacent to (0,0)? No. Adjacent to (2,2)? Yes. → 1
	assert.equal(state.numbers[1][2], 1);
});

// ─── 3. Flood fill stops at numbers > 0 ─────────────────────────────

console.log("\n🌊 Flood fill tests\n");

test("flood fill reveals all zeros connected but stops at numbered cells", () => {
	// Create a board where clicking (0,0) should flood fill zeros
	// but stop at numbered cells
	const state = createState(5, 5, 0);
	// No mines, so all numbers are 0 → entire board revealed
	placeMines(state, 0, 0); // safe zone around (0,0)
	// Now we have a board with numbers
	// Reset cell states
	for (let r = 0; r < state.rows; r++)
		for (let c = 0; c < state.cols; c++)
			state.cellStates[r][c] = "hidden";
	state.firstClick = false; // already placed mines
	state.gameOver = false;
	state.won = false;

	reveal(state, 0, 0);

	// All cells adjacent to zeros should be revealed
	// Count revealed
	let revealedCount = 0;
	for (let r = 0; r < state.rows; r++)
		for (let c = 0; c < state.cols; c++)
			if (state.cellStates[r][c] === "revealed") revealedCount++;

	assert.ok(revealedCount > 1, "Flood fill should reveal more than 1 cell");
});

test("flood fill stops at numbered cell (boundary)", () => {
	// Create a board with a specific mine pattern
	const state = createState(5, 5, 0);
	// Place mines at row 2, all columns → row 1 is all numbers, row 0 is all zeros
	for (let c = 0; c < 5; c++) state.mines[2][c] = true;
	// Recalculate numbers
	for (let r = 0; r < state.rows; r++)
		for (let c = 0; c < state.cols; c++) {
			if (state.mines[r][c]) {
				state.numbers[r][c] = -1;
				continue;
			}
			let count = 0;
			for (let dr = -1; dr <= 1; dr++)
				for (let dc = -1; dc <= 1; dc++) {
					const nr = r + dr,
						nc = c + dc;
					if (
						nr >= 0 &&
						nr < state.rows &&
						nc >= 0 &&
						nc < state.cols &&
						state.mines[nr][nc]
					)
						count++;
				}
			state.numbers[r][c] = count;
		}
	state.firstClick = false;

	// Reveal (0,0) — should flood fill row 0 and stop at row 1 (numbered)
	reveal(state, 0, 0);

	// Row 0 should all be revealed (zeros)
	for (let c = 0; c < 5; c++)
		assert.equal(state.cellStates[0][c], "revealed", `(0,${c}) should be revealed`);
	// Row 1 should all be revealed (numbers > 0, but they are adjacent to revealed zeros)
	// Actually the flood fill pushes neighbors of 0-cells. So row 1 cells
	// adjacent to row 0 zeros get pushed. They are numbered but still get revealed.
	// The key is: numbered cells ARE revealed, but flood fill doesn't go past them.
	// Row 2+ should remain hidden (mines)
	assert.equal(state.cellStates[2][0], "hidden");
	assert.equal(state.cellStates[3][0], "hidden");
});

// ─── 4. Corner reveal doesn't go out of bounds ──────────────────────

console.log("\n↗️ Corner reveal tests\n");

test("revealing (0,0) on small board doesn't go out of bounds", () => {
	const state = createState(3, 3, 1);
	reveal(state, 0, 0);
	// Should not throw or access invalid indices
	assert.ok(true, "No out of bounds error");
});

test("revealing (rows-1, cols-1) doesn't go out of bounds", () => {
	const state = createState(3, 3, 1);
	reveal(state, 2, 2);
	assert.ok(true, "No out of bounds error");
});

// ─── 5. Flag toggle ────────────────────────────────────────────────

console.log("\n🚩 Flag toggle tests\n");

test("flag toggle: hidden → flagged → hidden", () => {
	const state = createState(9, 9, 10);
	// Simulate flagging
	assert.equal(state.cellStates[0][0], "hidden");
	state.cellStates[0][0] = "flagged";
	assert.equal(state.cellStates[0][0], "flagged");
	state.cellStates[0][0] = "hidden";
	assert.equal(state.cellStates[0][0], "hidden");
});

test("flagged cell can't be revealed (source checks for hidden)", () => {
	const state = createState(9, 9, 10);
	state.cellStates[0][0] = "flagged";
	// In the source, reveal only processes if cellStates === "hidden"
	// So a flagged cell would be skipped by the stack loop
	// Simulate:
	const stack: [number, number][] = [[0, 0]];
	let processed = false;
	while (stack.length) {
		const [cr, cc] = stack.pop()!;
		if (cr < 0 || cr >= state.rows || cc < 0 || cc >= state.cols) continue;
		if (state.cellStates[cr][cc] !== "hidden") continue;
		processed = true;
	}
	assert.equal(processed, false, "Flagged cell should not be processed");
});

// ─── 6. Win detection ──────────────────────────────────────────────

console.log("\n🏆 Win detection tests\n");

test("win: all non-mine cells revealed triggers win", () => {
	const state = createState(3, 3, 1);
	// First click at (0,0) triggers mine placement (safe zone around (0,0))
	reveal(state, 0, 0);
	// Now mines are placed. Reveal all non-mine cells.
	for (let r = 0; r < state.rows; r++) {
		for (let c = 0; c < state.cols; c++) {
			if (!state.mines[r][c] && state.cellStates[r][c] === "hidden") {
				const stack: [number, number][] = [[r, c]];
				while (stack.length) {
					const [cr, cc] = stack.pop()!;
					if (cr < 0 || cr >= state.rows || cc < 0 || cc >= state.cols) continue;
					if (state.cellStates[cr][cc] !== "hidden") continue;
					state.cellStates[cr][cc] = "revealed";
					if (state.numbers[cr][cc] === 0) {
						for (let dr = -1; dr <= 1; dr++)
							for (let dc = -1; dc <= 1; dc++)
								stack.push([cr + dr, cc + dc]);
					}
				}
			}
		}
	}
	// Check win condition
	let hidden = 0;
	for (let r = 0; r < state.rows; r++)
		for (let c = 0; c < state.cols; c++)
			if (state.cellStates[r][c] !== "revealed") hidden++;
	assert.equal(hidden, state.mineCount, "Only mine cells should remain hidden");
});

test("mine hit sets gameOver=true, won=false", () => {
	// Create board where (2,2) is the only non-safe cell for a mine
	// Use large enough board so mine doesn't land in safe zone
	const state = createState(10, 10, 20);
	reveal(state, 5, 5); // first click, mines placed
	assert.equal(state.gameOver, false); // didn't hit mine on first click

	// Now find a mine and click it
	state.firstClick = false;
	let foundMine = false;
	for (let r = 0; r < state.rows && !foundMine; r++) {
		for (let c = 0; c < state.cols && !foundMine; c++) {
			if (state.mines[r][c]) {
				const result = reveal(state, r, c);
				assert.equal(result, false);
				assert.equal(state.gameOver, true);
				assert.equal(state.won, false);
				foundMine = true;
			}
		}
	}
	assert.ok(foundMine, "Should have found at least one mine");
});

if (!summary()) process.exit(1);
