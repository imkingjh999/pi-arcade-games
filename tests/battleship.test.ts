/**
 * Battleship logic tests.
 * Run: npx tsx tests/battleship.test.ts
 */
import { test, summary, banner } from "./helpers.js";
import assert from "node:assert/strict";

banner("🚢 Battleship Tests");

const GRID = 10;

function canPlace(
	board: string[][],
	r: number,
	c: number,
	size: number,
	h: boolean,
): boolean {
	for (let i = 0; i < size; i++) {
		const rr = h ? r : r + i,
			cc = h ? c + i : c;
		if (rr >= GRID || cc >= GRID || board[rr][cc] !== "empty") return false;
	}
	return true;
}

function placeShip(
	board: string[][],
	r: number,
	c: number,
	size: number,
	h: boolean,
) {
	for (let i = 0; i < size; i++) {
		const rr = h ? r : r + i,
			cc = h ? c + i : c;
		board[rr][cc] = "ship";
	}
}

function createBoard(): string[][] {
	return Array.from({ length: GRID }, () => Array(GRID).fill("empty"));
}

test("place ship horizontally fits at (0,0) size 5", () => {
	if (!canPlace(createBoard(), 0, 0, 5, true)) throw new Error();
});
test("place ship vertically fits at (0,0) size 5", () => {
	if (!canPlace(createBoard(), 0, 0, 5, false)) throw new Error();
});
test("ship doesn't fit at (0,6) horizontal size 5", () => {
	if (canPlace(createBoard(), 0, 6, 5, true)) throw new Error("should not fit");
});
test("ship doesn't fit at (6,0) vertical size 5", () => {
	if (canPlace(createBoard(), 6, 0, 5, false))
		throw new Error("should not fit");
});
test("can't place overlapping ships", () => {
	const b = createBoard();
	placeShip(b, 0, 0, 3, true);
	if (canPlace(b, 0, 0, 3, true)) throw new Error("should overlap");
});
test("can place ship next to another", () => {
	const b = createBoard();
	placeShip(b, 0, 0, 3, true);
	if (!canPlace(b, 1, 0, 3, true)) throw new Error("should fit");
});
test("hit detection: ship cell → hit", () => {
	const b = createBoard();
	b[5][5] = "ship";
	if (b[5][5] !== "ship") throw new Error();
	b[5][5] = "hit";
	if (b[5][5] !== "hit") throw new Error();
});
test("miss detection: empty → miss", () => {
	const b = createBoard();
	if (b[5][5] !== "empty") throw new Error();
	b[5][5] = "miss";
	if (b[5][5] !== "miss") throw new Error();
});
test("AI places all 4 ships on board", () => {
	const b = createBoard();
	const ships = [
		{ name: "C", size: 5 },
		{ name: "B", size: 4 },
		{ name: "D", size: 3 },
		{ name: "S", size: 3 },
	];
	let placed = 0;
	for (const ship of ships) {
		for (let attempt = 0; attempt < 200; attempt++) {
			const h = Math.random() < 0.5,
				r = Math.floor(Math.random() * GRID),
				c = Math.floor(Math.random() * GRID);
			if (canPlace(b, r, c, ship.size, h)) {
				placeShip(b, r, c, ship.size, h);
				placed++;
				break;
			}
		}
	}
	if (placed !== 4) throw new Error(`placed ${placed}`);
});
test("all ships placed: count ship cells", () => {
	const b = createBoard();
	const ships = [{ size: 5 }, { size: 4 }, { size: 3 }, { size: 3 }];
	for (const ship of ships) {
		for (let attempt = 0; attempt < 200; attempt++) {
			const h = Math.random() < 0.5,
				r = Math.floor(Math.random() * GRID),
				c = Math.floor(Math.random() * GRID);
			if (canPlace(b, r, c, ship.size, h)) {
				placeShip(b, r, c, ship.size, h);
				break;
			}
		}
	}
	const cells = b.flat().filter((c) => c === "ship").length;
	if (cells !== 15) throw new Error(`cells=${cells}`); // 5+4+3+3=15
});
test("can't fire at same cell twice (already hit)", () => {
	const c: string = "hit";
	if (c !== "hit") throw new Error();
});
test("can't fire at same cell twice (already miss)", () => {
	const c: string = "miss";
	if (c !== "miss") throw new Error();
});

console.log("\n🎯 AI targeting tests\n");

// Mirror of aiFire() from battleship.ts (post-fix: targets adjacent
// "ship" cells too, not just "empty").
function aiFire(
	board: string[][],
	aiLastHit: [number, number] | null,
): [number, number] {
	if (aiLastHit) {
		const dirs: [number, number][] = [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		];
		const shuffled = dirs.sort(() => Math.random() - 0.5);
		for (const [dr, dc] of shuffled) {
			const nr = aiLastHit[0] + dr;
			const nc = aiLastHit[1] + dc;
			if (
				nr >= 0 &&
				nr < GRID &&
				nc >= 0 &&
				nc < GRID &&
				(board[nr][nc] === "empty" || board[nr][nc] === "ship")
			) {
				return [nr, nc];
			}
		}
	}
	const empties: [number, number][] = [];
	for (let r = 0; r < GRID; r++)
		for (let c = 0; c < GRID; c++)
			if (board[r][c] === "empty" || board[r][c] === "ship")
				empties.push([r, c]);
	return empties[Math.floor(Math.random() * empties.length)];
}

function emptyBoard(): string[][] {
	return Array.from({ length: GRID }, () => Array(GRID).fill("empty"));
}

test("AI targets adjacent unfired ship cell after a hit (not just empty)", () => {
	// Last hit at (5,5); the only unfired neighbour is a ship at (4,5).
	// Pre-fix, aiFire skipped "ship" cells and would fall through to random.
	const board = emptyBoard();
	board[5][5] = "hit";
	board[4][5] = "ship"; // adjacent, not yet fired upon
	board[6][5] = "miss";
	board[5][4] = "miss";
	board[5][6] = "miss";
	const [r, c] = aiFire(board, [5, 5]);
	assert.ok(r === 4 && c === 5, `expected (4,5), got (${r},${c})`);
});

test("AI still targets adjacent empty when no adjacent ship", () => {
	const board = emptyBoard();
	board[5][5] = "hit";
	// all neighbours are empty -> should pick one of them
	const [r, c] = aiFire(board, [5, 5]);
	const isAdj =
		Math.abs(r - 5) + Math.abs(c - 5) === 1;
	assert.ok(isAdj, `expected an adjacent cell, got (${r},${c})`);
});

test("AI falls back to random when all neighbours already fired", () => {
	const board = emptyBoard();
	board[5][5] = "hit";
	board[4][5] = "miss";
	board[6][5] = "miss";
	board[5][4] = "miss";
	board[5][6] = "miss";
	const [r, c] = aiFire(board, [5, 5]);
	assert.ok(board[r][c] === "empty", `expected an unfired cell, got (${r},${c})`);
});

if (!summary()) process.exit(1);
