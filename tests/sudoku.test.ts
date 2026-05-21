/**
 * Sudoku logic tests.
 * Run: npx tsx tests/sudoku.test.ts
 */
import { test, summary, banner } from "./helpers.js";

banner("🧩 Sudoku Tests");

function isValidPlacement(
	board: number[][],
	row: number,
	col: number,
	num: number,
): boolean {
	for (let c = 0; c < 9; c++) if (board[row][c] === num) return false;
	for (let r = 0; r < 9; r++) if (board[r][col] === num) return false;
	const br = Math.floor(row / 3) * 3,
		bc = Math.floor(col / 3) * 3;
	for (let r = br; r < br + 3; r++)
		for (let c = bc; c < bc + 3; c++) if (board[r][c] === num) return false;
	return true;
}

function solveSudoku(board: number[][]): boolean {
	for (let r = 0; r < 9; r++)
		for (let c = 0; c < 9; c++) {
			if (board[r][c] !== 0) continue;
			for (let n = 1; n <= 9; n++) {
				if (isValidPlacement(board, r, c, n)) {
					board[r][c] = n;
					if (solveSudoku(board)) return true;
					board[r][c] = 0;
				}
			}
			return false;
		}
	return true;
}

function hasConflict(board: number[][], row: number, col: number): boolean {
	const v = board[row][col];
	if (v === 0) return false;
	for (let c = 0; c < 9; c++) if (c !== col && board[row][c] === v) return true;
	for (let r = 0; r < 9; r++) if (r !== row && board[r][col] === v) return true;
	const br = Math.floor(row / 3) * 3,
		bc = Math.floor(col / 3) * 3;
	for (let r = br; r < br + 3; r++)
		for (let c = bc; c < bc + 3; c++)
			if ((r !== row || c !== col) && board[r][c] === v) return true;
	return false;
}

function isBoardComplete(board: number[][]): boolean {
	for (let r = 0; r < 9; r++)
		for (let c = 0; c < 9; c++)
			if (board[r][c] === 0 || hasConflict(board, r, c)) return false;
	return true;
}

test("empty board is not complete", () => {
	const board = Array.from({ length: 9 }, () => Array(9).fill(0));
	if (isBoardComplete(board))
		throw new Error("empty board should not be complete");
});

test("solver generates valid complete board", () => {
	const board = Array.from({ length: 9 }, () => Array(9).fill(0));
	if (!solveSudoku(board)) throw new Error("solver failed");
	// Check all rows unique
	for (let r = 0; r < 9; r++) {
		if (new Set(board[r]).size !== 9) throw new Error(`row ${r} not unique`);
	}
	// Check all cols unique
	for (let c = 0; c < 9; c++) {
		const col = board.map((r) => r[c]);
		if (new Set(col).size !== 9) throw new Error(`col ${c} not unique`);
	}
	// Check all 3x3 boxes unique
	for (let br = 0; br < 3; br++)
		for (let bc = 0; bc < 3; bc++) {
			const box: number[] = [];
			for (let r = br * 3; r < br * 3 + 3; r++)
				for (let c = bc * 3; c < bc * 3 + 3; c++) box.push(board[r][c]);
			if (new Set(box).size !== 9)
				throw new Error(`box ${br},${bc} not unique`);
		}
});

test("duplicate in same row = conflict", () => {
	const board = Array.from({ length: 9 }, () => Array(9).fill(0));
	board[0][0] = 5;
	board[0][1] = 5;
	if (!hasConflict(board, 0, 0)) throw new Error("should detect row conflict");
});

test("duplicate in same col = conflict", () => {
	const board = Array.from({ length: 9 }, () => Array(9).fill(0));
	board[0][3] = 7;
	board[5][3] = 7;
	if (!hasConflict(board, 0, 3)) throw new Error("should detect col conflict");
});

test("duplicate in same 3x3 box = conflict", () => {
	const board = Array.from({ length: 9 }, () => Array(9).fill(0));
	board[0][0] = 3;
	board[2][2] = 3;
	if (!hasConflict(board, 0, 0)) throw new Error("should detect box conflict");
});

test("no conflict for valid placement", () => {
	const board = Array.from({ length: 9 }, () => Array(9).fill(0));
	board[0][0] = 1;
	board[0][1] = 2;
	board[1][0] = 3;
	board[1][1] = 4;
	if (hasConflict(board, 0, 0)) throw new Error("should be no conflict");
});

test("isBoardComplete true for solved board", () => {
	const board = Array.from({ length: 9 }, () => Array(9).fill(0));
	solveSudoku(board);
	if (!isBoardComplete(board))
		throw new Error("solved board should be complete");
});

test("removing cells makes board incomplete", () => {
	const board = Array.from({ length: 9 }, () => Array(9).fill(0));
	solveSudoku(board);
	board[0][0] = 0;
	if (isBoardComplete(board))
		throw new Error("incomplete board should not pass");
});

test("isValidPlacement rejects same number in row", () => {
	const board = Array.from({ length: 9 }, () => Array(9).fill(0));
	board[0][5] = 7;
	if (isValidPlacement(board, 0, 0, 7))
		throw new Error("should reject same in row");
});

test("isValidPlacement accepts valid number", () => {
	const board = Array.from({ length: 9 }, () => Array(9).fill(0));
	board[0][0] = 1;
	if (!isValidPlacement(board, 0, 1, 2)) throw new Error("should accept 2");
});

if (!summary()) process.exit(1);
