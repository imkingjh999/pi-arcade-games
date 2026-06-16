/**
 * Tic-Tac-Toe logic tests (win detection + ascii formatting).
 *
 * Run: npx tsx tests/tictactoe.test.ts
 */
import assert from "node:assert/strict";
import { test, summary, banner } from "./helpers.js";

banner("⭕ Tic-Tac-Toe Tests");

type Cell = " " | "X" | "O";
type GameStatus = "playing" | "win_X" | "win_O" | "draw";

function emptyBoard(): Cell[][] {
	return [
		[" ", " ", " "],
		[" ", " ", " "],
		[" ", " ", " "],
	];
}

// ─── Mirror of getWinLine / checkWin from tictactoe.ts ──────────────

function getWinLine(board: Cell[][]): [number, number][] | null {
	const lines: [number, number][][] = [
		[
			[0, 0],
			[0, 1],
			[0, 2],
		],
		[
			[1, 0],
			[1, 1],
			[1, 2],
		],
		[
			[2, 0],
			[2, 1],
			[2, 2],
		],
		[
			[0, 0],
			[1, 0],
			[2, 0],
		],
		[
			[0, 1],
			[1, 1],
			[2, 1],
		],
		[
			[0, 2],
			[1, 2],
			[2, 2],
		],
		[
			[0, 0],
			[1, 1],
			[2, 2],
		],
		[
			[0, 2],
			[1, 1],
			[2, 0],
		],
	];
	for (const line of lines) {
		const vals = line.map(([r, c]) => board[r][c]);
		if (vals[0] !== " " && vals[0] === vals[1] && vals[1] === vals[2])
			return line;
	}
	return null;
}

function checkWin(board: Cell[][]): GameStatus {
	const winLine = getWinLine(board);
	if (winLine) {
		const [r, c] = winLine[0];
		return board[r][c] === "X" ? "win_X" : "win_O";
	}
	if (board.every((row) => row.every((c) => c !== " "))) return "draw";
	return "playing";
}

// ─── Tests ──────────────────────────────────────────────────────────

test("empty board is 'playing'", () => {
	assert.equal(checkWin(emptyBoard()), "playing");
});

test("top row of X → win_X", () => {
	const b = emptyBoard();
	b[0][0] = "X";
	b[0][1] = "X";
	b[0][2] = "X";
	assert.equal(checkWin(b), "win_X");
});

test("diagonal of O → win_O", () => {
	const b = emptyBoard();
	b[0][0] = "O";
	b[1][1] = "O";
	b[2][2] = "O";
	assert.equal(checkWin(b), "win_O");
});

test("anti-diagonal of X → win_X", () => {
	const b = emptyBoard();
	b[0][2] = "X";
	b[1][1] = "X";
	b[2][0] = "X";
	assert.equal(checkWin(b), "win_X");
});

test("column win for O", () => {
	const b = emptyBoard();
	b[0][1] = "O";
	b[1][1] = "O";
	b[2][1] = "O";
	assert.equal(checkWin(b), "win_O");
});

test("full board with no line → draw", () => {
	const b: Cell[][] = [
		["X", "O", "X"],
		["X", "X", "O"],
		["O", "X", "O"],
	];
	assert.equal(checkWin(b), "draw");
});

test("two-in-a-row is still 'playing'", () => {
	const b = emptyBoard();
	b[1][0] = "X";
	b[1][1] = "X";
	assert.equal(checkWin(b), "playing");
});

test("getWinLine returns the winning coordinates", () => {
	const b = emptyBoard();
	b[2][0] = "O";
	b[2][1] = "O";
	b[2][2] = "O";
	const line = getWinLine(b);
	assert.deepEqual(line, [
		[2, 0],
		[2, 1],
		[2, 2],
	]);
});

test("getWinLine returns null when no winner", () => {
	assert.equal(getWinLine(emptyBoard()), null);
});

if (!summary()) process.exit(1);
