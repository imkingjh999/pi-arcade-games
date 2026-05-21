/**
 * 2048 game logic tests.
 *
 * Tests slide(), move(), canMove(), addRandomTile() extracted from source.
 *
 * Run: npx tsx tests/2048.test.ts
 */

import assert from "node:assert/strict";
import { test, summary, banner, reset } from "./helpers.js";

// ─── Extract game logic (mirrors 2048.ts exactly) ───────────────────

function slide(row: number[]): { result: number[]; score: number } {
	const filtered = row.filter((v) => v !== 0);
	const result: number[] = [];
	let score = 0;
	let i = 0;
	while (i < filtered.length) {
		if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
			const merged = filtered[i] * 2;
			result.push(merged);
			score += merged;
			i += 2;
		} else {
			result.push(filtered[i]);
			i++;
		}
	}
	while (result.length < 4) result.push(0);
	return { result, score };
}

function move(
	board: number[][],
	dir: "up" | "down" | "left" | "right",
): { board: number[][]; score: number; moved: boolean } {
	const b = board.map((r) => [...r]);
	let totalScore = 0;

	if (dir === "left" || dir === "right") {
		for (let r = 0; r < 4; r++) {
			const row = b[r].slice();
			if (dir === "right") row.reverse();
			const { result, score } = slide(row);
			if (dir === "right") result.reverse();
			totalScore += score;
			b[r] = result;
		}
	} else {
		for (let c = 0; c < 4; c++) {
			const col = [b[0][c], b[1][c], b[2][c], b[3][c]];
			if (dir === "down") col.reverse();
			const { result, score } = slide(col);
			if (dir === "down") result.reverse();
			totalScore += score;
			for (let r = 0; r < 4; r++) b[r][c] = result[r];
		}
	}

	let moved = false;
	for (let r = 0; r < 4; r++)
		for (let c = 0; c < 4; c++) if (b[r][c] !== board[r][c]) moved = true;
	return { board: b, score: totalScore, moved };
}

function canMove(board: number[][]): boolean {
	for (let r = 0; r < 4; r++)
		for (let c = 0; c < 4; c++) {
			if (board[r][c] === 0) return true;
			if (c < 3 && board[r][c] === board[r][c + 1]) return true;
			if (r < 3 && board[r][c] === board[r + 1][c]) return true;
		}
	return false;
}

function addRandomTile(board: number[][]): void {
	const empty: [number, number][] = [];
	for (let r = 0; r < 4; r++)
		for (let c = 0; c < 4; c++) if (board[r][c] === 0) empty.push([r, c]);
	if (empty.length === 0) return;
	const [r, c] = empty[Math.floor(Math.random() * empty.length)];
	board[r][c] = Math.random() < 0.9 ? 2 : 4;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

banner("2048 Logic Tests");

// ─── 1. slide() function ────────────────────────────────────────────

console.log("\n📋 slide() function tests\n");

test("[2,0,0,2] → [4,0,0,0], score 4", () => {
	const { result, score } = slide([2, 0, 0, 2]);
	assert.deepEqual(result, [4, 0, 0, 0]);
	assert.equal(score, 4);
});

test("[2,2,2,2] → [4,4,0,0], score 8", () => {
	const { result, score } = slide([2, 2, 2, 2]);
	assert.deepEqual(result, [4, 4, 0, 0]);
	assert.equal(score, 8);
});

test("[4,4,8,8] → [8,16,0,0], score 24", () => {
	const { result, score } = slide([4, 4, 8, 8]);
	assert.deepEqual(result, [8, 16, 0, 0]);
	assert.equal(score, 24);
});

test("[0,0,0,0] → [0,0,0,0], score 0", () => {
	const { result, score } = slide([0, 0, 0, 0]);
	assert.deepEqual(result, [0, 0, 0, 0]);
	assert.equal(score, 0);
});

test("[2,0,0,0] → [2,0,0,0], score 0", () => {
	const { result, score } = slide([2, 0, 0, 0]);
	assert.deepEqual(result, [2, 0, 0, 0]);
	assert.equal(score, 0);
});

test("[0,0,0,4] → [4,0,0,0], score 0", () => {
	const { result, score } = slide([0, 0, 0, 4]);
	assert.deepEqual(result, [4, 0, 0, 0]);
	assert.equal(score, 0);
});

test("[2,4,2,4] → [2,4,2,4], score 0 (no merges)", () => {
	const { result, score } = slide([2, 4, 2, 4]);
	assert.deepEqual(result, [2, 4, 2, 4]);
	assert.equal(score, 0);
});

// ─── 2. Right slide via move() ──────────────────────────────────────

console.log("\n➡️ Right slide tests\n");

test("right slide: [2,0,0,2] row → [0,0,0,4]", () => {
	const board = [[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
	const { board: b, moved } = move(board, "right");
	assert.deepEqual(b[0], [0, 0, 0, 4]);
	assert.equal(moved, true);
});

test("right slide: [2,2,2,2] → [0,0,4,4]", () => {
	const board = [[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
	const { board: b } = move(board, "right");
	assert.deepEqual(b[0], [0, 0, 4, 4]);
});

// ─── 3. canMove ─────────────────────────────────────────────────────

console.log("\n🔍 canMove() tests\n");

test("canMove: empty cell detected", () => {
	const board = [
		[2, 4, 8, 16],
		[32, 64, 128, 256],
		[512, 1024, 0, 2048],
		[4, 8, 16, 32],
	];
	assert.equal(canMove(board), true);
});

test("canMove: stuck board detected", () => {
	const board = [
		[2, 4, 8, 16],
		[16, 2, 4, 8],
		[8, 16, 2, 4],
		[4, 8, 16, 2],
	];
	assert.equal(canMove(board), false);
});

test("canMove: adjacent same values → can move", () => {
	const board = [
		[2, 2, 4, 8],
		[16, 32, 64, 128],
		[256, 512, 1024, 2048],
		[4, 8, 16, 32],
	];
	assert.equal(canMove(board), true);
});

test("canMove: full board with vertical pair → can move", () => {
	const board = [
		[2, 4, 8, 16],
		[2, 32, 64, 128],
		[4, 8, 16, 32],
		[8, 16, 32, 64],
	];
	assert.equal(canMove(board), true); // [2,2] in col 0 vertically adjacent
});

// ─── 4. addRandomTile ───────────────────────────────────────────────

console.log("\n🎲 addRandomTile() tests\n");

test("addRandomTile only adds 2 or 4", () => {
	const board = [
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
	];
	for (let i = 0; i < 200; i++) {
		const b = board.map((r) => [...r]);
		addRandomTile(b);
		const val = b.flat().find((v) => v !== 0);
		assert.ok(val === 2 || val === 4, `Unexpected tile value: ${val}`);
	}
});

test("addRandomTile places exactly one tile", () => {
	const board = [
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
	];
	addRandomTile(board);
	const nonZero = board.flat().filter((v) => v !== 0);
	assert.equal(nonZero.length, 1);
});

test("addRandomTile does nothing on full board", () => {
	const board = [
		[2, 4, 8, 16],
		[32, 64, 128, 256],
		[512, 1024, 2048, 4],
		[8, 16, 32, 64],
	];
	const before = board.map((r) => [...r]);
	addRandomTile(board);
	assert.deepEqual(board, before);
});

// ─── 5. Game over when no moves ─────────────────────────────────────

console.log("\n💀 Game over detection tests\n");

test("game over: stuck board means canMove=false", () => {
	const board = [
		[2, 4, 8, 16],
		[16, 2, 4, 8],
		[8, 16, 2, 4],
		[4, 8, 16, 2],
	];
	assert.equal(canMove(board), false);
	// In the real game, gameOver would be set when !canMove
});

test("move on stuck board: no move possible", () => {
	const board = [
		[2, 4, 8, 16],
		[16, 2, 4, 8],
		[8, 16, 2, 4],
		[4, 8, 16, 2],
	];
	const { moved } = move(board, "left");
	assert.equal(moved, false);
});

// ─── 6. Vertical moves ─────────────────────────────────────────────

console.log("\n⬆️⬇️ Vertical move tests\n");

test("up move: column slides and merges", () => {
	const board = [
		[0, 0, 0, 0],
		[2, 0, 0, 0],
		[0, 0, 0, 0],
		[2, 0, 0, 0],
	];
	const { board: b } = move(board, "up");
	assert.equal(b[0][0], 4);
	assert.equal(b[1][0], 0);
	assert.equal(b[2][0], 0);
	assert.equal(b[3][0], 0);
});

test("down move: column slides and merges", () => {
	const board = [
		[2, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[2, 0, 0, 0],
	];
	const { board: b } = move(board, "down");
	assert.equal(b[3][0], 4);
	assert.equal(b[0][0], 0);
});

if (!summary()) process.exit(1);
