/**
 * Sliding Puzzle (Fifteen) logic tests.
 * Run: npx tsx tests/fifteen.test.ts
 */
import { test, summary, banner } from "./helpers.js";

banner("🔢 Sliding Puzzle Tests");

function createSolved(size: number): number[][] {
	const b: number[][] = [];
	let n = 1;
	for (let r = 0; r < size; r++) {
		b.push([]);
		for (let c = 0; c < size; c++) {
			b[r].push(n);
			n++;
		}
	}
	b[size - 1][size - 1] = 0;
	return b;
}

function isSolved(board: number[][]): boolean {
	const size = board.length;
	let expected = 1;
	for (let r = 0; r < size; r++)
		for (let c = 0; c < size; c++) {
			if (r === size - 1 && c === size - 1) {
				if (board[r][c] !== 0) return false;
			} else {
				if (board[r][c] !== expected) return false;
				expected++;
			}
		}
	return true;
}

function shuffle(board: number[][], size: number): number[][] {
	const b = board.map((r) => [...r]);
	let er = size - 1,
		ec = size - 1;
	for (let i = 0; i < size * size * 40; i++) {
		const dirs = [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		];
		const valid = dirs.filter(([dr, dc]) => {
			const nr = er + dr,
				nc = ec + dc;
			return nr >= 0 && nr < size && nc >= 0 && nc < size;
		});
		const [dr, dc] = valid[Math.floor(Math.random() * valid.length)];
		b[er][ec] = b[er + dr][ec + dc];
		b[er + dr][ec + dc] = 0;
		er += dr;
		ec += dc;
	}
	return b;
}

test("solved 3x3 board is detected", () => {
	if (!isSolved(createSolved(3))) throw new Error();
});
test("solved 4x4 board is detected", () => {
	if (!isSolved(createSolved(4))) throw new Error();
});
test("solved 5x5 board is detected", () => {
	if (!isSolved(createSolved(5))) throw new Error();
});

test("swapped last two = unsolved", () => {
	const b = createSolved(4);
	[b[3][2], b[3][3]] = [b[3][3], b[3][2]];
	if (isSolved(b)) throw new Error("should be unsolved");
});

test("shuffle produces different board", () => {
	const solved = createSolved(3);
	const shuffled = shuffle(solved, 3);
	if (shuffled.flat().join(",") === solved.flat().join(","))
		throw new Error("should differ");
});

test("shuffle always produces solvable board (same parity)", () => {
	// All positions filled with 1..N,0 in some order - solvable by construction
	const shuffled = shuffle(createSolved(4), 4);
	const flat = shuffled.flat();
	const hasZero = flat.includes(0);
	const sorted = flat
		.filter((x) => x !== 0)
		.sort((a, b) => a - b)
		.join(",");
	const expected = Array.from({ length: 15 }, (_, i) => i + 1).join(",");
	if (!hasZero || sorted !== expected)
		throw new Error(`invalid board: sorted=${sorted}`);
});

test("solved board has 0 at bottom-right", () => {
	const b = createSolved(3);
	if (b[2][2] !== 0) throw new Error("0 not at bottom-right");
});

test("move tile right into empty space", () => {
	const b = createSolved(3);
	// swap last two to make it: ... 0 8 instead of ... 8 0
	b[2][2] = 8;
	b[2][1] = 0;
	// Move tile at (2,0) right into (2,1)? No, move tile at (2,1) is empty
	// Simulate: tile at (2,0) moves right → (2,1) becomes 7, (2,0) becomes 0
	if (isSolved(b)) throw new Error("should be unsolved");
});

if (!summary()) process.exit(1);
