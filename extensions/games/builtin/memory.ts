/**
 * Memory - Flip cards and find matching pairs.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	type Component,
	matchesKey,
	visibleWidth,
	truncateToWidth,
} from "@earendil-works/pi-tui";
import type { GameModule, GameMeta } from "../types.js";
import { type Lang, getLang, gui } from "../i18n.js";
import {
	BOLD,
	DIM,
	RED,
	GREEN,
	YELLOW,
	BLUE,
	MAGENTA,
	CYAN,
	BOLD_GREEN,
	BOLD_RED,
	BOLD_YELLOW,
	BOLD_CYAN,
	centerPad,
} from "../ansi.js";

type _Component = Component;

// ═══════════════════════════════════════════════════════════════════════════
// Constants & Types
// ═══════════════════════════════════════════════════════════════════════════

const GRID_COLS = 4;
const GRID_ROWS = 4;
const TOTAL_PAIRS = (GRID_COLS * GRID_ROWS) / 2;

const SYMBOLS = ["♥", "★", "◆", "♣", "♠", "●", "▲", "■"];
const SYMBOL_COLORS = [
	(s: string) => RED(s),
	(s: string) => YELLOW(s),
	(s: string) => BLUE(s),
	(s: string) => GREEN(s),
	(s: string) => MAGENTA(s),
	(s: string) => CYAN(s),
	(s: string) => `\x1b[38;5;208m${s}\x1b[0m`,
	(s: string) => BOLD(s),
];

interface Card {
	symbolIdx: number;
	flipped: boolean;
	matched: boolean;
}

interface GameState {
	cards: Card[];
	cursor: number; // index into cards
	firstPick: number | null;
	secondPick: number | null;
	moves: number;
	matches: number;
	gameOver: boolean;
	waiting: boolean; // waiting before hiding mismatched pair
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
	// Create pairs
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

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class MemoryComponent implements _Component {
	private state: GameState;
	private waitTimeout: ReturnType<typeof setTimeout> | null = null;
	private onClose: () => void;
	private onSave: (s: GameState | null) => void;
	private tui: { requestRender: () => void };
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	private lang: Lang;

	constructor(
		tui: { requestRender: () => void },
		onClose: () => void,
		onSave: (s: GameState | null) => void,
		lang: Lang,
		saved?: GameState,
	) {
		this.tui = tui;
		this.onClose = onClose;
		this.onSave = onSave;
		this.lang = lang;
		if (saved && !saved.gameOver) {
			this.state = saved;
		} else {
			this.state = createInitialState();
			if (saved) this.state.bestScore = saved.bestScore;
		}
	}

	private cardAt(idx: number): Card {
		return this.state.cards[idx];
	}

	private flipCard(idx: number) {
		if (this.state.waiting) return;
		const card = this.cardAt(idx);
		if (card.flipped || card.matched) return;

		card.flipped = true;
		this.version++;

		if (this.state.firstPick === null) {
			this.state.firstPick = idx;
		} else if (this.state.secondPick === null && idx !== this.state.firstPick) {
			this.state.secondPick = idx;
			this.state.moves++;

			const first = this.cardAt(this.state.firstPick);
			const second = this.cardAt(idx);

			if (first.symbolIdx === second.symbolIdx) {
				// Match!
				first.matched = true;
				second.matched = true;
				this.state.matches++;
				this.state.firstPick = null;
				this.state.secondPick = null;

				if (this.state.matches === TOTAL_PAIRS) {
					this.state.gameOver = true;
					if (
						this.state.bestScore === 0 ||
						this.state.moves < this.state.bestScore
					) {
						this.state.bestScore = this.state.moves;
					}
				}
			} else {
				// Mismatch - wait then flip back
				this.state.waiting = true;
				this.waitTimeout = setTimeout(() => {
					first.flipped = false;
					second.flipped = false;
					this.state.firstPick = null;
					this.state.secondPick = null;
					this.state.waiting = false;
					this.version++;
					this.tui.requestRender();
				}, 800);
			}
		}
		this.tui.requestRender();
	}

	handleInput(data: string): boolean {
		if (matchesKey(data, "escape")) {
			this.dispose();
			this.onSave(this.state);
			this.onClose();
			return true;
		}

		if (this.state.gameOver) {
			if (data === "r" || data === " ") {
				const bs = this.state.bestScore;
				this.state = createInitialState();
				this.state.bestScore = bs;
				this.version++;
				this.tui.requestRender();
			}
			return true;
		}

		const cur = this.state.cursor;
		const row = Math.floor(cur / GRID_COLS);
		const col = cur % GRID_COLS;

		if (matchesKey(data, "up") || data === "w") {
			if (row > 0) this.state.cursor -= GRID_COLS;
		} else if (matchesKey(data, "down") || data === "s") {
			if (row < GRID_ROWS - 1) this.state.cursor += GRID_COLS;
		} else if (matchesKey(data, "left") || data === "a") {
			if (col > 0) this.state.cursor--;
		} else if (matchesKey(data, "right") || data === "d") {
			if (col < GRID_COLS - 1) this.state.cursor++;
		} else if (data === " " || data === "\r") {
			this.flipCard(cur);
		}

		this.version++;
		this.tui.requestRender();
		return true;
	}

	invalidate() {
		this.cachedWidth = 0;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;

		const lines: string[] = [];
		const cardW = 8;
		const cardH = 3;
		const gap = 2;
		const totalW = GRID_COLS * cardW + (GRID_COLS - 1) * gap;

		const padLine = (l: string) => {
			const vl = visibleWidth(l);
			if (vl >= width) return truncateToWidth(l, width);
			return l + " ".repeat(width - vl);
		};

		// Header
		const best =
			this.state.bestScore > 0
				? ` ${DIM("│")} ${gui("best", this.lang)}: ${BOLD(String(this.state.bestScore))}`
				: "";
		lines.push(
			padLine(
				centerPad(
					`${BOLD_CYAN("MEMORY")} ${DIM("│")} ${gui("moves", this.lang)}: ${BOLD_YELLOW(String(this.state.moves))} ${DIM("│")} ${gui("pairs", this.lang)}: ${BOLD_GREEN(String(this.state.matches) + "/" + TOTAL_PAIRS)}${best}`,
					width,
				),
			),
		);
		lines.push("");

		// Render cards
		for (let r = 0; r < GRID_ROWS; r++) {
			for (let line = 0; line < cardH; line++) {
				let row = "";
				for (let c = 0; c < GRID_COLS; c++) {
					const idx = r * GRID_COLS + c;
					const card = this.state.cards[idx];
					const isCursor = idx === this.state.cursor;
					const revealed = card.flipped || card.matched;

					if (c > 0) row += " ".repeat(gap);

					if (line === 0) {
						// Top border
						const border = isCursor ? BOLD_YELLOW("╭──────╮") : DIM("╭──────╮");
						row += border;
					} else if (line === 1) {
						// Content
						if (revealed) {
							const sym = SYMBOLS[card.symbolIdx];
							const clr = SYMBOL_COLORS[card.symbolIdx];
							const content = `  ${clr(BOLD(sym))}   `;
							if (card.matched) {
								row += GREEN("│") + content + GREEN("│");
							} else {
								row += "│" + content + "│";
							}
						} else {
							const inner = isCursor ? BOLD_YELLOW("  ░░░ ") : DIM("  ░░░ ");
							row += "│" + inner + "│";
						}
					} else {
						// Bottom border
						const border = isCursor ? BOLD_YELLOW("╰──────╯") : DIM("╰──────╯");
						row += border;
					}
				}
				lines.push(padLine(centerPad(row, width)));
			}
			if (r < GRID_ROWS - 1) lines.push("");
		}

		lines.push("");

		// Footer
		let footer: string;
		if (this.state.gameOver) {
			footer = `${BOLD_GREEN(gui("youWin", this.lang))} ${`Completed in ${BOLD(String(this.state.moves))} ${gui("movesAction", this.lang)}`} ${BOLD("R")} ${gui("playAgain", this.lang)}`;
		} else {
			footer = `${gui("move", this.lang)}  ${BOLD("SPACE")} ${gui("flip", this.lang)}  ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
		}
		lines.push(padLine(centerPad(footer, width)));

		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}

	dispose() {
		if (this.waitTimeout) {
			clearTimeout(this.waitTimeout);
			this.waitTimeout = null;
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// GameModule export
// ═══════════════════════════════════════════════════════════════════════════

const INTRO = {
	en: `Memory - Card Matching

Use arrow keys to move cursor, ENTER to flip cards.
Find all matching pairs in as few moves as possible!`,
	zh: `记忆翻牌 - 配对游戏

用方向键移动光标，ENTER 翻开卡牌。
尽量用最少的步数找到所有配对！`,
};

const SAVE_TYPE = "memory-save";

const gameMemory: GameModule = {
	meta: {
		id: "memory",
		name: "Memory",
		description: "Flip & match pairs / 翻牌配对",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Memory requires interactive mode", "error");
				return;
			}
			const lang = getLang(ctx);
			const entries = ctx.sessionManager.getEntries();
			let saved: GameState | undefined;
			for (let i = entries.length - 1; i >= 0; i--) {
				const e = entries[i];
				if (e.type === "custom" && e.customType === SAVE_TYPE) {
					saved = e.data as GameState;
					break;
				}
			}
			await ctx.ui.custom((tui, _t, _kb, done) => {
				return new MemoryComponent(
					tui,
					() => done(undefined),
					(s) => pi.appendEntry(SAVE_TYPE, s),
					lang,
					saved,
				);
			});
		};

		registerMenuEntry(gameMemory.meta, handler, SAVE_TYPE);
	},
};

export default gameMemory;
