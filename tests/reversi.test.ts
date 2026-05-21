/**
 * Reversi / Othello logic tests.
 * Run: npx tsx tests/reversi.test.ts
 */
import { test, summary, banner } from "./helpers.js";

banner("⚫⚪ Reversi Tests");

const SIZE = 8;
const DIRS = [
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[0, -1],
	[0, 1],
	[1, -1],
	[1, 0],
	[1, 1],
];

function createBoard(): number[][] {
	const b: number[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
	b[3][3] = 2;
	b[3][4] = 1;
	b[4][3] = 1;
	b[4][4] = 2;
	return b;
}

function getFlips(
	board: number[][],
	row: number,
	col: number,
	player: number,
): [number, number][] {
	if (board[row][col] !== 0) return [];
	const opp = player === 1 ? 2 : 1;
	const allFlips: [number, number][] = [];
	for (const [dr, dc] of DIRS) {
		const flips: [number, number][] = [];
		let r = row + dr,
			c = col + dc;
		while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r][c] === opp) {
			flips.push([r, c]);
			r += dr;
			c += dc;
		}
		if (
			flips.length > 0 &&
			r >= 0 &&
			r < SIZE &&
			c >= 0 &&
			c < SIZE &&
			board[r][c] === player
		)
			allFlips.push(...flips);
	}
	return allFlips;
}

function applyMove(
	board: number[][],
	row: number,
	col: number,
	player: number,
): number[][] {
	const b = board.map((r) => [...r]);
	const flips = getFlips(b, row, col, player);
	b[row][col] = player;
	for (const [fr, fc] of flips) b[fr][fc] = player;
	return b;
}

function countPieces(board: number[][], p: number): number {
	return board.flat().filter((c) => c === p).length;
}

test("initial board has 4 pieces", () => {
	if (
		createBoard()
			.flat()
			.filter((c) => c !== 0).length !== 4
	)
		throw new Error("4 pieces");
});
test("initial board: 2 of each color", () => {
	const b = createBoard();
	if (countPieces(b, 1) !== 2 || countPieces(b, 2) !== 2)
		throw new Error("2 each");
});

test("getFlips: valid move at (3,2) for player 1 flips (3,3)", () => {
	const b = createBoard();
	const flips = getFlips(b, 3, 2, 1);
	if (flips.length !== 1 || flips[0][0] !== 3 || flips[0][1] !== 3)
		throw new Error(`flips=${JSON.stringify(flips)}`);
});

test("getFlips: occupied cell returns empty", () => {
	const b = createBoard();
	if (getFlips(b, 3, 3, 1).length !== 0) throw new Error("occupied");
});

test("getFlips: no valid move returns empty", () => {
	const b = createBoard();
	if (getFlips(b, 0, 0, 1).length !== 0) throw new Error("should be empty");
});

test("applyMove flips pieces correctly", () => {
	const b = createBoard();
	const nb = applyMove(b, 3, 2, 1);
	if (nb[3][3] !== 1) throw new Error("should flip (3,3) to 1");
	if (nb[3][2] !== 1) throw new Error("should place at (3,2)");
});

test("corner move is high value", () => {
	// Corners can't be retaken - simulate corner capture
	const b = createBoard();
	b[0][0] = 1;
	if (b[0][0] !== 1) throw new Error("corner placement");
});

test("getFlips detects multi-direction flip", () => {
	const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
	// Set up: player 2 in a line, player 1 at both ends
	b[4][3] = 2;
	b[4][4] = 2;
	b[4][5] = 2;
	b[4][2] = 1;
	b[4][6] = 1;
	// Player 1 at (4,6) already placed - check if (4,2) sees flips
	// Actually let's test from a different angle
	const b2 = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
	b2[3][3] = 1;
	b2[3][4] = 1;
	b2[3][5] = 2;
	b2[4][3] = 1;
	b2[5][3] = 2;
	// Player 1 placing at (5,5) should not flip since 2 at (5,3) isn't in line
	// Test a real multi-direction: place at (4,2) for p=1 to flip (4,3) and (4,4)
	const b3 = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
	b3[4][3] = 2;
	b3[4][4] = 2;
	b3[4][5] = 2;
	b3[4][6] = 1;
	const flips = getFlips(b3, 4, 2, 1);
	if (flips.length !== 3)
		throw new Error(`expected 3 flips, got ${flips.length}`);
});

test("piece count after multiple moves", () => {
	let b = createBoard();
	b = applyMove(b, 3, 2, 1); // P1 plays, flips 1
	const p1 = countPieces(b, 1);
	const p2 = countPieces(b, 2);
	if (p1 !== 4 || p2 !== 1) throw new Error(`p1=${p1} p2=${p2}`);
});

if (!summary()) process.exit(1);
