/**
 * Memory game logic tests.
 *
 * Tests card creation (16 cards = 8 pairs), matching, mismatched flip-back,
 * already-flipped rejection, game over, best score tracking.
 *
 * Run: npx tsx tests/memory.test.ts
 */

import assert from "node:assert/strict";
import { test, summary, banner, reset } from "./helpers.js";

// ─── Extract game logic (mirrors memory.ts exactly) ─────────────────

const GRID_COLS = 4;
const GRID_ROWS = 4;
const TOTAL_PAIRS = (GRID_COLS * GRID_ROWS) / 2;

interface Card {
	symbolIdx: number;
	flipped: boolean;
	matched: boolean;
}

interface GameState {
	cards: Card[];
	cursor: number;
	firstPick: number | null;
	secondPick: number | null;
	moves: number;
	matches: number;
	gameOver: boolean;
	waiting: boolean;
	bestScore: number;
}

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function createInitialState(): GameState {
	const pairs: number[] = [];
	for (let i = 0; i < TOTAL_PAIRS; i++) {
		pairs.push(i, i);
	}
	const shuffled = shuffle(pairs);
	const cards: Card[] = shuffled.map((idx) => ({
		symbolIdx: idx,
		flipped: false,
		matched: false,
	}));

	return {
		cards,
		cursor: 0,
		firstPick: null,
		secondPick: null,
		moves: 0,
		matches: 0,
		gameOver: false,
		waiting: false,
		bestScore: 0,
	};
}

// Simulate flipCard logic (synchronous version without setTimeout)
function flipCard(state: GameState, idx: number): void {
	if (state.waiting) return;
	const card = state.cards[idx];
	if (card.flipped || card.matched) return;

	card.flipped = true;

	if (state.firstPick === null) {
		state.firstPick = idx;
	} else if (state.secondPick === null && idx !== state.firstPick) {
		state.secondPick = idx;
		state.moves++;

		const first = state.cards[state.firstPick];
		const second = state.cards[idx];

		if (first.symbolIdx === second.symbolIdx) {
			// Match!
			first.matched = true;
			second.matched = true;
			state.matches++;
			state.firstPick = null;
			state.secondPick = null;

			if (state.matches === TOTAL_PAIRS) {
				state.gameOver = true;
				if (state.bestScore === 0 || state.moves < state.bestScore) {
					state.bestScore = state.moves;
				}
			}
		} else {
			// Mismatch — simulate the timeout flip-back immediately for testing
			first.flipped = false;
			second.flipped = false;
			state.firstPick = null;
			state.secondPick = null;
			state.waiting = false;
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

banner("Memory Logic Tests");

// ─── 1. 16 cards = 8 pairs, shuffle produces valid pairs ───────────

console.log("\n🃏 Card creation tests\n");

test("16 cards created", () => {
	const state = createInitialState();
	assert.equal(state.cards.length, 16);
});

test("8 pairs present (each symbolIdx appears exactly twice)", () => {
	const state = createInitialState();
	const counts: Record<number, number> = {};
	for (const card of state.cards) {
		counts[card.symbolIdx] = (counts[card.symbolIdx] || 0) + 1;
	}
	assert.equal(Object.keys(counts).length, TOTAL_PAIRS);
	for (const [idx, count] of Object.entries(counts)) {
		assert.equal(
			count,
			2,
			`symbolIdx ${idx} appears ${count} times, expected 2`,
		);
	}
});

test("shuffle produces different orderings (statistically)", () => {
	const orders = new Set<string>();
	for (let i = 0; i < 20; i++) {
		const state = createInitialState();
		orders.add(state.cards.map((c) => c.symbolIdx).join(","));
	}
	// Should get at least a few different orderings in 20 shuffles
	assert.ok(orders.size > 1, "Shuffle should produce varied orderings");
});

test("all cards start face-down and unmatched", () => {
	const state = createInitialState();
	for (const card of state.cards) {
		assert.equal(card.flipped, false);
		assert.equal(card.matched, false);
	}
});

// ─── 2. Matching pair: both marked matched, matches++ ──────────────

console.log("\n✅ Matching pair tests\n");

test("matching pair: both cards marked matched", () => {
	const state = createInitialState();
	// Find a matching pair
	const idx0 = state.cards.findIndex((c) => c.symbolIdx === 0);
	const idx1 = state.cards.findIndex((c, i) => i !== idx0 && c.symbolIdx === 0);

	flipCard(state, idx0);
	flipCard(state, idx1);

	assert.equal(state.cards[idx0].matched, true);
	assert.equal(state.cards[idx1].matched, true);
	assert.equal(state.matches, 1);
	assert.equal(state.moves, 1);
});

test("matching pair: firstPick and secondPick reset to null", () => {
	const state = createInitialState();
	const idx0 = state.cards.findIndex((c) => c.symbolIdx === 0);
	const idx1 = state.cards.findIndex((c, i) => i !== idx0 && c.symbolIdx === 0);

	flipCard(state, idx0);
	flipCard(state, idx1);

	assert.equal(state.firstPick, null);
	assert.equal(state.secondPick, null);
});

// ─── 3. Mismatched pair: flipped back ──────────────────────────────

console.log("\n🔄 Mismatched pair tests\n");

test("mismatched pair: both flipped back after mismatch", () => {
	const state = createInitialState();
	// Find two cards with different symbols
	const idx0 = state.cards.findIndex((c) => c.symbolIdx === 0);
	const idx1 = state.cards.findIndex((c) => c.symbolIdx === 1);

	flipCard(state, idx0);
	flipCard(state, idx1);

	assert.equal(state.cards[idx0].flipped, false);
	assert.equal(state.cards[idx1].flipped, false);
	assert.equal(state.cards[idx0].matched, false);
	assert.equal(state.cards[idx1].matched, false);
	assert.equal(state.matches, 0);
	assert.equal(state.moves, 1);
});

test("mismatched pair: picks reset to null", () => {
	const state = createInitialState();
	const idx0 = state.cards.findIndex((c) => c.symbolIdx === 0);
	const idx1 = state.cards.findIndex((c) => c.symbolIdx === 1);

	flipCard(state, idx0);
	flipCard(state, idx1);

	assert.equal(state.firstPick, null);
	assert.equal(state.secondPick, null);
});

// ─── 4. Already flipped card can't be picked ────────────────────────

console.log("\n🚫 Already flipped card rejection tests\n");

test("can't pick the same card twice (firstPick = idx, pick idx again)", () => {
	const state = createInitialState();
	const idx0 = state.cards.findIndex((c) => c.symbolIdx === 0);

	flipCard(state, idx0);
	assert.equal(state.firstPick, idx0);

	// Try picking the same card again
	flipCard(state, idx0);
	// Should still have firstPick = idx0, secondPick = null
	// (source: secondPick === null && idx !== firstPick — idx === firstPick, so skipped)
	assert.equal(state.firstPick, idx0);
	assert.equal(state.secondPick, null);
	assert.equal(state.moves, 0);
});

test("can't pick a matched card", () => {
	const state = createInitialState();
	const idx0 = state.cards.findIndex((c) => c.symbolIdx === 0);
	const idx1 = state.cards.findIndex((c, i) => i !== idx0 && c.symbolIdx === 0);

	// Match the pair
	flipCard(state, idx0);
	flipCard(state, idx1);
	assert.equal(state.cards[idx0].matched, true);

	// Try picking the matched card again
	flipCard(state, idx0);
	// Should be rejected (card.matched === true)
	assert.equal(state.moves, 1); // still 1
	assert.equal(state.firstPick, null); // stays null after match
});

// ─── 5. Game over when all pairs matched ────────────────────────────

console.log("\n🏆 Game over tests\n");

test("game over when all pairs matched", () => {
	const state = createInitialState();
	// Match all pairs
	for (let sym = 0; sym < TOTAL_PAIRS; sym++) {
		const idx0 = state.cards.findIndex(
			(c) => c.symbolIdx === sym && !c.matched,
		);
		const idx1 = state.cards.findIndex(
			(c, i) => i !== idx0 && c.symbolIdx === sym && !c.matched,
		);
		flipCard(state, idx0);
		flipCard(state, idx1);
	}
	assert.equal(state.matches, TOTAL_PAIRS);
	assert.equal(state.gameOver, true);
});

test("game over doesn't trigger before all pairs matched", () => {
	const state = createInitialState();
	const idx0 = state.cards.findIndex((c) => c.symbolIdx === 0);
	const idx1 = state.cards.findIndex((c, i) => i !== idx0 && c.symbolIdx === 0);
	flipCard(state, idx0);
	flipCard(state, idx1);
	assert.equal(state.matches, 1);
	assert.equal(state.gameOver, false);
});

// ─── 6. Best score tracking ─────────────────────────────────────────

console.log("\n🥇 Best score tracking tests\n");

test("best score set to moves on game over", () => {
	const state = createInitialState();
	// Match all pairs
	for (let sym = 0; sym < TOTAL_PAIRS; sym++) {
		const idx0 = state.cards.findIndex(
			(c) => c.symbolIdx === sym && !c.matched,
		);
		const idx1 = state.cards.findIndex(
			(c, i) => i !== idx0 && c.symbolIdx === sym && !c.matched,
		);
		flipCard(state, idx0);
		flipCard(state, idx1);
	}
	assert.equal(state.bestScore, state.moves);
	assert.ok(state.bestScore >= TOTAL_PAIRS, "Best score should be at least 8");
});

test("best score updates if next game is better", () => {
	// Simulate first game with bestScore = 12
	const state = createInitialState();
	state.bestScore = 12;

	// Now complete game with fewer moves
	for (let sym = 0; sym < TOTAL_PAIRS; sym++) {
		const idx0 = state.cards.findIndex(
			(c) => c.symbolIdx === sym && !c.matched,
		);
		const idx1 = state.cards.findIndex(
			(c, i) => i !== idx0 && c.symbolIdx === sym && !c.matched,
		);
		flipCard(state, idx0);
		flipCard(state, idx1);
	}
	assert.equal(state.bestScore, TOTAL_PAIRS); // 8 is better than 12
});

test("best score stays if next game is worse", () => {
	// Simulate having bestScore = 8
	// Create state with pre-set bestScore and artificially inflate moves
	const state = createInitialState();
	state.bestScore = 8;
	// Manually match cards but inflate moves
	for (let sym = 0; sym < TOTAL_PAIRS; sym++) {
		const idx0 = state.cards.findIndex(
			(c) => c.symbolIdx === sym && !c.matched,
		);
		const idx1 = state.cards.findIndex(
			(c, i) => i !== idx0 && c.symbolIdx === sym && !c.matched,
		);
		flipCard(state, idx0);
		// Make a wrong move first
		const wrongIdx = state.cards.findIndex(
			(c, i) => i !== idx0 && c.symbolIdx !== sym && !c.matched && !c.flipped,
		);
		if (wrongIdx !== -1) {
			flipCard(state, wrongIdx); // mismatch → moves++
		}
		flipCard(state, idx1);
	}
	// bestScore should stay 8 since moves > 8
	assert.equal(state.bestScore, 8);
});

// ═══════════════════════════════════════════════════════════════════════════
// Rendering alignment tests
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n📐 Card rendering alignment tests\n");

const CARD_INNER_WIDTH = 6; // interior between ╭──────╮ borders
const SYMBOLS = ["♥", "★", "◆", "♣", "♠", "●", "▲", "■"];
const RESET = "\x1b[0m";
const BOLD = (s: string) => `\x1b[1m${s}${RESET}`;
const DIM = (s: string) => `\x1b[2m${s}${RESET}`;
const GREEN = (s: string) => `\x1b[32m${s}${RESET}`;
const RED = (s: string) => `\x1b[31m${s}${RESET}`;
const YELLOW = (s: string) => `\x1b[33m${s}${RESET}`;
const BLUE = (s: string) => `\x1b[34m${s}${RESET}`;
const MAGENTA = (s: string) => `\x1b[35m${s}${RESET}`;
const CYAN = (s: string) => `\x1b[36m${s}${RESET}`;
const BOLD_YELLOW = (s: string) => `\x1b[1;33m${s}${RESET}`;

const SYMBOL_COLORS = [
	RED,
	YELLOW,
	BLUE,
	GREEN,
	MAGENTA,
	CYAN,
	(s: string) => `\x1b[38;5;208m${s}${RESET}`,
	BOLD,
];

function visibleLen(s: string): number {
	return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

test("top border is 8 visible chars (╭──────╮)", () => {
	const border = "╭──────╮";
	assert.equal(border.length, 8);
});

test("bottom border is 8 visible chars (╰──────╯)", () => {
	const border = "╰──────╯";
	assert.equal(border.length, 8);
});

test("revealed card content line is 8 visible chars (│ + 6 interior + │)", () => {
	// Simulate all 8 symbol types
	for (let i = 0; i < 8; i++) {
		const sym = SYMBOLS[i];
		const clr = SYMBOL_COLORS[i];
		const content = `  ${clr(BOLD(sym))}   `;
		const line = "│" + content + "│";
		const vl = visibleLen(line);
		assert.equal(vl, 8, `symbol ${sym} content line = ${vl}, expected 8`);
	}
});

test("unrevealed card content line is 8 visible chars", () => {
	const inner = DIM("  ░░░ ");
	const line = "│" + inner + "│";
	const vl = visibleLen(line);
	assert.equal(vl, 8, `unrevealed line = ${vl}, expected 8`);
});

test("cursor-highlighted unrevealed card content line is 8 visible chars", () => {
	const inner = BOLD_YELLOW("  ░░░ ");
	const line = "│" + inner + "│";
	const vl = visibleLen(line);
	assert.equal(vl, 8, `cursor unrevealed line = ${vl}, expected 8`);
});

test("matched card content line is 8 visible chars (green borders)", () => {
	const sym = SYMBOLS[0];
	const clr = SYMBOL_COLORS[0];
	const content = `  ${clr(BOLD(sym))}   `;
	const line = GREEN("│") + content + GREEN("│");
	const vl = visibleLen(line);
	assert.equal(vl, 8, `matched line = ${vl}, expected 8`);
});

test("all card rows (border + content) have identical visible width", () => {
	for (let i = 0; i < 8; i++) {
		const sym = SYMBOLS[i];
		const clr = SYMBOL_COLORS[i];
		const content = `  ${clr(BOLD(sym))}   `;
		const topBorder = "╭──────╮";
		const botBorder = "╰──────╯";
		const revealedLine = "│" + content + "│";

		assert.equal(
			visibleLen(topBorder),
			visibleLen(revealedLine),
			`top border vs revealed content for ${sym}`,
		);
		assert.equal(
			visibleLen(botBorder),
			visibleLen(revealedLine),
			`bot border vs revealed content for ${sym}`,
		);
	}

	// Also check unrevealed
	const inner = DIM("  ░░░ ");
	const unrevealedLine = "│" + inner + "│";
	assert.equal(
		visibleLen("╭──────╮"),
		visibleLen(unrevealedLine),
		"top border vs unrevealed content",
	);
});

if (!summary()) process.exit(1);
