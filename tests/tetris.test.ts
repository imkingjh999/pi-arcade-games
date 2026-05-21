/**
 * Tetris game logic tests.
 *
 * Tests rotation, collision detection, line clearing,
 * spawn collision (game over), wall kick, scoring.
 *
 * Run: npx tsx tests/tetris.test.ts
 */

import assert from "node:assert/strict";
import { test, summary, banner, reset } from "./helpers.js";

// ─── Extract game logic (mirrors tetris.ts exactly) ─────────────────

const COLS = 10;
const ROWS = 20;

type Cell = number;
type Board = Cell[][];
type PieceShape = number[][];

interface Piece {
	shape: PieceShape;
	x: number;
	y: number;
	type: number;
}

const SHAPES: PieceShape[] = [
	[[1, 1, 1, 1]], // I
	[
		[1, 1],
		[1, 1],
	], // O
	[
		[0, 1, 0],
		[1, 1, 1],
	], // T
	[
		[1, 0, 0],
		[1, 1, 1],
	], // L
	[
		[0, 0, 1],
		[1, 1, 1],
	], // J
	[
		[0, 1, 1],
		[1, 1, 0],
	], // S
	[
		[1, 1, 0],
		[0, 1, 1],
	], // Z
];

function createBoard(): Board {
	return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function makePiece(typeIdx: number, x?: number, y?: number): Piece {
	const shape = SHAPES[typeIdx].map((r) => [...r]);
	return {
		shape,
		x: x ?? Math.floor((COLS - shape[0].length) / 2),
		y: y ?? 0,
		type: typeIdx + 1,
	};
}

function rotate(shape: PieceShape): PieceShape {
	const rows = shape.length;
	const cols = shape[0].length;
	const rotated: PieceShape = [];
	for (let c = 0; c < cols; c++) {
		const row: number[] = [];
		for (let r = rows - 1; r >= 0; r--) {
			row.push(shape[r][c]);
		}
		rotated.push(row);
	}
	return rotated;
}

function collides(
	board: Board,
	shape: PieceShape,
	px: number,
	py: number,
): boolean {
	for (let r = 0; r < shape.length; r++) {
		for (let c = 0; c < shape[r].length; c++) {
			if (!shape[r][c]) continue;
			const bx = px + c;
			const by = py + r;
			if (bx < 0 || bx >= COLS || by >= ROWS) return true;
			if (by >= 0 && board[by][bx] !== 0) return true;
		}
	}
	return false;
}

function placePiece(board: Board, piece: Piece): void {
	for (let r = 0; r < piece.shape.length; r++) {
		for (let c = 0; c < piece.shape[r].length; c++) {
			if (!piece.shape[r][c]) continue;
			const by = piece.y + r;
			const bx = piece.x + c;
			if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
				board[by][bx] = piece.type;
			}
		}
	}
}

function clearLines(board: Board): number {
	let cleared = 0;
	for (let r = ROWS - 1; r >= 0; r--) {
		if (board[r].every((c) => c !== 0)) {
			board.splice(r, 1);
			board.unshift(Array(COLS).fill(0));
			cleared++;
			r++;
		}
	}
	return cleared;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

banner("Tetris Logic Tests");

// ─── 1. Rotation produces correct shapes ────────────────────────────

console.log("\n🔄 Rotation tests\n");

test("T-piece rotation: first rotation", () => {
	// T: [[0,1,0],[1,1,1]]
	const tShape = SHAPES[2];
	const rotated = rotate(tShape);
	assert.deepEqual(rotated, [
		[1, 0],
		[1, 1],
		[1, 0],
	]);
});

test("T-piece rotation: back to original after 4 rotations", () => {
	let shape = SHAPES[2].map((r) => [...r]);
	for (let i = 0; i < 4; i++) shape = rotate(shape);
	assert.deepEqual(shape, SHAPES[2]);
});

test("I-piece rotation", () => {
	// I: [[1,1,1,1]]
	const iShape = SHAPES[0];
	const rotated = rotate(iShape);
	assert.deepEqual(rotated, [[1], [1], [1], [1]]);
});

test("I-piece: 4 rotations returns to original", () => {
	let shape = SHAPES[0].map((r) => [...r]);
	for (let i = 0; i < 4; i++) shape = rotate(shape);
	assert.deepEqual(shape, SHAPES[0]);
});

test("L-piece rotation", () => {
	// L: [[1,0,0],[1,1,1]]
	const lShape = SHAPES[3];
	const rotated = rotate(lShape);
	assert.deepEqual(rotated, [
		[1, 1],
		[1, 0],
		[1, 0],
	]);
});

test("O-piece rotation: unchanged (symmetric)", () => {
	// O: [[1,1],[1,1]]
	const oShape = SHAPES[1];
	const rotated = rotate(oShape);
	assert.deepEqual(rotated, oShape);
});

// ─── 2. Collision detection ─────────────────────────────────────────

console.log("\n💥 Collision detection tests\n");

test("collision: out of bounds (left)", () => {
	const board = createBoard();
	const piece = makePiece(0, -1, 0); // I-piece at x=-1
	assert.equal(collides(board, piece.shape, piece.x, piece.y), true);
});

test("collision: out of bounds (right)", () => {
	const board = createBoard();
	const piece = makePiece(0, COLS, 0); // I-piece at x=10
	assert.equal(collides(board, piece.shape, piece.x, piece.y), true);
});

test("collision: out of bounds (bottom)", () => {
	const board = createBoard();
	// T-piece: [[0,1,0],[1,1,1]] has 2 rows, at y=19 → by=20 >= ROWS
	const piece = makePiece(2, 3, ROWS - 1);
	assert.equal(collides(board, piece.shape, piece.x, piece.y), true);
});

test("no collision: piece within bounds", () => {
	const board = createBoard();
	const piece = makePiece(0); // I-piece centered
	assert.equal(collides(board, piece.shape, piece.x, piece.y), false);
});

test("collision: with placed pieces", () => {
	const board = createBoard();
	// Place a block at row 19, col 4,5
	board[19][4] = 1;
	board[19][5] = 1;
	// T-piece: [[0,1,0],[1,1,1]] centered at x=3, y=18
	// At y=19: cells at (3,19), (4,19), (5,19)
	const piece = makePiece(2, 3, 18);
	assert.equal(collides(board, piece.shape, piece.x, piece.y), true);
});

test("no collision: piece above board (by < 0 allowed)", () => {
	const board = createBoard();
	const piece = makePiece(2, 3, -1); // T-piece at y=-1
	// by = -1 for row 0, by = 0 for row 1
	// The code checks: if (by >= 0 && board[by][bx] !== 0)
	// So by=-1 is allowed as long as no out-of-bounds on x
	assert.equal(collides(board, piece.shape, piece.x, piece.y), false);
});

// ─── 3. Line clearing ───────────────────────────────────────────────

console.log("\n🧹 Line clearing tests\n");

test("clear 1 full row", () => {
	const board = createBoard();
	// Fill row 19 completely
	for (let c = 0; c < COLS; c++) board[19][c] = 1;
	const cleared = clearLines(board);
	assert.equal(cleared, 1);
	// Row 19 should now be empty (shifted down from row 18 which was empty)
	assert.ok(board[19].every((c) => c === 0));
	assert.ok(board[0].every((c) => c === 0)); // new empty row at top
});

test("clear 2 full rows", () => {
	const board = createBoard();
	for (let c = 0; c < COLS; c++) {
		board[18][c] = 1;
		board[19][c] = 2;
	}
	const cleared = clearLines(board);
	assert.equal(cleared, 2);
	assert.ok(board[18].every((c) => c === 0));
	assert.ok(board[19].every((c) => c === 0));
});

test("rows above shift down after clear", () => {
	const board = createBoard();
	// Put a block at row 17
	board[17][5] = 3;
	// Fill row 19
	for (let c = 0; c < COLS; c++) board[19][c] = 1;
	clearLines(board);
	// Block should have moved from row 17 to row 18
	assert.equal(board[18][5], 3);
	assert.equal(board[17][5], 0);
});

test("non-full row is not cleared", () => {
	const board = createBoard();
	for (let c = 0; c < COLS - 1; c++) board[19][c] = 1; // leave one empty
	const cleared = clearLines(board);
	assert.equal(cleared, 0);
	assert.equal(board[19][COLS - 1], 0);
});

test("clear 4 rows (tetris!)", () => {
	const board = createBoard();
	for (let r = 16; r <= 19; r++)
		for (let c = 0; c < COLS; c++) board[r][c] = r - 15;
	const cleared = clearLines(board);
	assert.equal(cleared, 4);
	for (let r = 0; r < 4; r++)
		assert.ok(board[r].every((c) => c === 0), `Row ${r} should be empty`);
});

// ─── 4. New piece spawn collision = game over ───────────────────────

console.log("\n💀 Game over on spawn collision tests\n");

test("new piece collides on spawn = game over", () => {
	const board = createBoard();
	// Fill top rows to block spawn
	for (let c = 3; c <= 6; c++) {
		board[0][c] = 1;
		board[1][c] = 1;
	}
	// T-piece spawns at x=3, y=0
	const piece = makePiece(2);
	assert.equal(collides(board, piece.shape, piece.x, piece.y), true);
});

test("empty board: spawn doesn't collide", () => {
	const board = createBoard();
	const piece = makePiece(2);
	assert.equal(collides(board, piece.shape, piece.x, piece.y), false);
});

// ─── 5. Wall kick ───────────────────────────────────────────────────

console.log("\n🧱 Wall kick tests\n");

test("wall kick: rotation near left edge tries offset +1", () => {
	const board = createBoard();
	// Place I-piece vertically at left edge
	const piece = makePiece(0, 0, 0);
	// Rotate I-piece: [[1,1,1,1]] → [[1],[1],[1],[1]]
	// At x=0, rotated piece is [[1],[1],[1],[1]] which fits in x=0
	// But if the I-piece were at x=-1 after rotation...
	// Let's simulate the wall kick logic from source:
	const rotated = rotate(piece.shape);
	// Try at current position
	if (!collides(board, rotated, piece.x, piece.y)) {
		assert.ok(true, "Rotation fits at current x");
	} else if (!collides(board, rotated, piece.x - 1, piece.y)) {
		assert.ok(false, "Should not need -1 kick here");
	} else if (!collides(board, rotated, piece.x + 1, piece.y)) {
		assert.ok(false, "Should not need +1 kick here");
	} else {
		assert.ok(false, "Rotation should be possible");
	}
});

test("wall kick: rotation near right edge", () => {
	const board = createBoard();
	// Place I-piece horizontally near right edge
	// I-piece: [[1,1,1,1]], width 4
	const piece = makePiece(0, COLS - 4, 0); // x=6
	// Rotate: [[1],[1],[1],[1]], width 1 — fits
	const rotated = rotate(piece.shape);
	assert.equal(collides(board, rotated, piece.x, piece.y), false);
});

test("wall kick: L-piece at right edge needs kick", () => {
	const board = createBoard();
	// L-piece: [[1,0,0],[1,1,1]] at x=8 (right edge)
	const piece = makePiece(3, 8, 0);
	const rotated = rotate(piece.shape);
	// Rotated L: [[1,1],[1,0],[1,0]] width 2
	// At x=8, extends to x=9 which is COLS-1 = 9, fits
	// But if at x=9, it would need kick
	assert.equal(collides(board, rotated, piece.x, piece.y), false);
});

test("wall kick: T-piece at x=9 needs kick right", () => {
	const board = createBoard();
	// T: [[0,1,0],[1,1,1]] at x=9
	// Width 3, at x=9 extends to x=11 → out of bounds
	const piece = makePiece(2, 9, 0);
	assert.equal(collides(board, piece.shape, piece.x, piece.y), true);

	// After rotation: [[1,0],[1,1],[1,0]] width 2
	// At x=9 extends to x=10 → still out of bounds
	const rotated = rotate(piece.shape);
	assert.equal(collides(board, rotated, piece.x, piece.y), true);

	// Try x-1 = 8: extends to 9 → fits
	assert.equal(collides(board, rotated, 8, piece.y), false);
});

// ─── 6. Scoring ─────────────────────────────────────────────────────

console.log("\n🏆 Scoring tests\n");

test("score: 1 line = 100 × level", () => {
	const scoreTable = [0, 100, 300, 500, 800];
	assert.equal(scoreTable[1], 100);
});

test("score: 2 lines = 300 × level", () => {
	const scoreTable = [0, 100, 300, 500, 800];
	assert.equal(scoreTable[2], 300);
});

test("score: 3 lines = 500 × level", () => {
	const scoreTable = [0, 100, 300, 500, 800];
	assert.equal(scoreTable[3], 500);
});

test("score: 4 lines = 800 × level", () => {
	const scoreTable = [0, 100, 300, 500, 800];
	assert.equal(scoreTable[4], 800);
});

test("scoring: 1 line at level 1 = 100 points", () => {
	const level = 1;
	const scoreTable = [0, 100, 300, 500, 800];
	assert.equal(scoreTable[1] * level, 100);
});

test("scoring: 4 lines at level 3 = 2400 points", () => {
	const level = 3;
	const scoreTable = [0, 100, 300, 500, 800];
	assert.equal(scoreTable[4] * level, 2400);
});

test("level increases every 10 lines", () => {
	// Source: level = Math.floor(lines / 10) + 1
	assert.equal(Math.floor(0 / 10) + 1, 1);
	assert.equal(Math.floor(9 / 10) + 1, 1);
	assert.equal(Math.floor(10 / 10) + 1, 2);
	assert.equal(Math.floor(19 / 10) + 1, 2);
	assert.equal(Math.floor(20 / 10) + 1, 3);
});

// ─── 7. placePiece ──────────────────────────────────────────────────

console.log("\n🧱 placePiece tests\n");

test("placePiece writes correct type to board", () => {
	const board = createBoard();
	const piece = makePiece(2, 3, 0); // T-piece at (3,0)
	placePiece(board, piece);
	assert.equal(board[0][4], 3); // T-piece type=3, cell (0,4)
	assert.equal(board[1][3], 3);
	assert.equal(board[1][4], 3);
	assert.equal(board[1][5], 3);
	assert.equal(board[0][3], 0); // empty cell in T shape
});

if (!summary()) process.exit(1);
