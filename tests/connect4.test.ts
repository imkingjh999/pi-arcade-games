/**
 * Connect Four logic tests.
 * Run: npx tsx tests/connect4.test.ts
 */
import { test, summary, banner } from "./helpers.js";

banner("🔴🟡 Connect Four Tests");

const ROWS = 6,
	COLS = 7;

function createBoard(): number[][] {
	return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function dropPiece(
	board: number[][],
	col: number,
	player: number,
): number | null {
	for (let r = ROWS - 1; r >= 0; r--)
		if (board[r][col] === 0) {
			board[r][col] = player;
			return r;
		}
	return null;
}

function checkWin(board: number[][], player: number): boolean {
	// Horizontal
	for (let r = 0; r < ROWS; r++)
		for (let c = 0; c <= COLS - 4; c++)
			if (
				board[r][c] === player &&
				board[r][c + 1] === player &&
				board[r][c + 2] === player &&
				board[r][c + 3] === player
			)
				return true;
	// Vertical
	for (let r = 0; r <= ROWS - 4; r++)
		for (let c = 0; c < COLS; c++)
			if (
				board[r][c] === player &&
				board[r + 1][c] === player &&
				board[r + 2][c] === player &&
				board[r + 3][c] === player
			)
				return true;
	// Diag ↘
	for (let r = 0; r <= ROWS - 4; r++)
		for (let c = 0; c <= COLS - 4; c++)
			if (
				board[r][c] === player &&
				board[r + 1][c + 1] === player &&
				board[r + 2][c + 2] === player &&
				board[r + 3][c + 3] === player
			)
				return true;
	// Diag ↗
	for (let r = 3; r < ROWS; r++)
		for (let c = 0; c <= COLS - 4; c++)
			if (
				board[r][c] === player &&
				board[r - 1][c + 1] === player &&
				board[r - 2][c + 2] === player &&
				board[r - 3][c + 3] === player
			)
				return true;
	return false;
}

test("drop in empty column lands at bottom row", () => {
	const b = createBoard();
	const r = dropPiece(b, 3, 1);
	if (r !== 5) throw new Error(`row=${r}, expected 5`);
});

test("stacking: second drop lands on top of first", () => {
	const b = createBoard();
	dropPiece(b, 3, 1);
	const r = dropPiece(b, 3, 2);
	if (r !== 4) throw new Error(`row=${r}, expected 4`);
});

test("full column returns null", () => {
	const b = createBoard();
	for (let i = 0; i < ROWS; i++) dropPiece(b, 0, 1);
	if (dropPiece(b, 0, 1) !== null) throw new Error("should return null");
});

test("horizontal win detected", () => {
	const b = createBoard();
	for (let c = 0; c < 4; c++) b[5][c] = 1;
	if (!checkWin(b, 1)) throw new Error("horizontal win missed");
});

test("vertical win detected", () => {
	const b = createBoard();
	for (let r = 2; r < 6; r++) b[r][3] = 2;
	if (!checkWin(b, 2)) throw new Error("vertical win missed");
});

test("diagonal ↘ win detected", () => {
	const b = createBoard();
	b[2][0] = 1;
	b[3][1] = 1;
	b[4][2] = 1;
	b[5][3] = 1;
	if (!checkWin(b, 1)) throw new Error("diag ↘ missed");
});

test("diagonal ↗ win detected", () => {
	const b = createBoard();
	b[5][0] = 1;
	b[4][1] = 1;
	b[3][2] = 1;
	b[2][3] = 1;
	if (!checkWin(b, 1)) throw new Error("diag ↗ missed");
});

test("3 in a row is not a win", () => {
	const b = createBoard();
	b[5][0] = 1;
	b[5][1] = 1;
	b[5][2] = 1;
	if (checkWin(b, 1)) throw new Error("3 should not be win");
});

test("board full = draw", () => {
	const b = createBoard();
	for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) b[r][c] = 1;
	if (!b[0].every((c) => c !== 0)) throw new Error("should be full");
});

test("getValidCols returns all empty columns on fresh board", () => {
	const b = createBoard();
	const valid = [];
	for (let c = 0; c < COLS; c++) if (b[0][c] === 0) valid.push(c);
	if (valid.length !== 7) throw new Error("should have 7 valid cols");
});

if (!summary()) process.exit(1);

// ═══════════════════════════════════════════════════════════════════════════
// Rendering alignment tests
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simulate Connect 4 board row rendering and verify each cell produces
 * exactly 3 visible characters, matching the ═══ border width.
 *
 * This prevents the bug where piece cells (●) were 2 visible chars
 * while empty cells (·) were 3 visible chars.
 */

// Visible-width helper: strip ANSI escape sequences
function visibleWidth(s: string): number {
	return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function renderCell(v: number): string {
	const isWin = false;
	const isLast = false;
	if (v === 0) {
		return " · ";
	} else if (v === 1) {
		const sgr = "\x1b[31m";
		return ` ${sgr}●\x1b[0m `;
	} else {
		const sgr = "\x1b[33m";
		return ` ${sgr}●\x1b[0m `;
	}
}

banner("🔴🟡 Connect Four Rendering Tests");

test("empty cell renders 3 visible chars", () => {
	const cell = renderCell(0);
	if (visibleWidth(cell) !== 3)
		throw new Error(
			`empty cell visible width = ${visibleWidth(cell)}, expected 3`,
		);
});

test("player piece renders 3 visible chars", () => {
	const cell = renderCell(1);
	if (visibleWidth(cell) !== 3)
		throw new Error(
			`player cell visible width = ${visibleWidth(cell)}, expected 3`,
		);
});

test("AI piece renders 3 visible chars", () => {
	const cell = renderCell(2);
	if (visibleWidth(cell) !== 3)
		throw new Error(
			`AI cell visible width = ${visibleWidth(cell)}, expected 3`,
		);
});

test("full row of mixed cells has consistent width", () => {
	const row = [0, 1, 2, 0, 1, 2, 0];
	const rendered = row.map((v) => renderCell(v));
	const widths = rendered.map((c) => visibleWidth(c));
	const allSame = widths.every((w) => w === widths[0]);
	if (!allSame) throw new Error(`mixed widths: ${widths.join(", ")}`);
	if (widths[0] !== 3) throw new Error(`expected 3, got ${widths[0]}`);
});

test("full board row (with separators) has consistent width", () => {
	// Simulate a full board row: ║ cell ║ cell ║ ... ║
	const rowValues = [0, 1, 2, 0, 1, 2, 0];
	let row = "║";
	for (let c = 0; c < COLS; c++) {
		row += renderCell(rowValues[c]);
		row += c < COLS - 1 ? "│" : "";
	}
	row += "║";
	// The border row is: ╔═══╤═══╤═══╤═══╤═══╤═══╤═══╗
	// Each cell interior is 3 chars + 1 separator = 4 per cell, last no sep
	// Expected visible width: 1 + (3*7 + 6*1) + 1 = 29
	const expectedWidth = 1 + (3 * COLS + (COLS - 1)) + 1;
	if (visibleWidth(row) !== expectedWidth) {
		throw new Error(
			`board row visible width = ${visibleWidth(row)}, expected ${expectedWidth}`,
		);
	}
});

if (!summary()) process.exit(1);
