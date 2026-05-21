/**
 * Minesweeper - Reveal cells, flag mines, clear the board.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey } from "@earendil-works/pi-tui";
import type { GameModule, GameMeta } from "../types.js";
import { type Lang, getLang, gui } from "../i18n.js";
import {
	BOLD,
	DIM,
	RED,
	GREEN,
	YELLOW,
	BLUE,
	BOLD_GREEN,
	BOLD_RED,
	BOLD_YELLOW,
	BOLD_BLUE,
	BOLD_CYAN,
	centerPad,
} from "../ansi.js";

const RESET = "\x1b[0m";
type _Component = Component;

// ═══════════════════════════════════════════════════════════════════════════
// Game types & constants
// ═══════════════════════════════════════════════════════════════════════════

type Difficulty = "easy" | "medium" | "hard";
type CellState = "hidden" | "revealed" | "flagged";

interface GameState {
	rows: number;
	cols: number;
	mineCount: number;
	mines: boolean[][];
	numbers: number[][];
	cellStates: CellState[][];
	gameOver: boolean;
	won: boolean;
	cursorRow: number;
	cursorCol: number;
	firstClick: boolean;
}

const CONFIGS: Record<
	Difficulty,
	{ rows: number; cols: number; mines: number }
> = {
	easy: { rows: 9, cols: 9, mines: 10 },
	medium: { rows: 16, cols: 16, mines: 40 },
	hard: { rows: 16, cols: 30, mines: 99 },
};

function createState(diff: Difficulty): GameState {
	const c = CONFIGS[diff];
	return {
		rows: c.rows,
		cols: c.cols,
		mineCount: c.mines,
		mines: Array.from({ length: c.rows }, () => Array(c.cols).fill(false)),
		numbers: Array.from({ length: c.rows }, () => Array(c.cols).fill(0)),
		cellStates: Array.from({ length: c.rows }, () =>
			Array(c.cols).fill("hidden"),
		),
		gameOver: false,
		won: false,
		cursorRow: 0,
		cursorCol: 0,
		firstClick: true,
	};
}

function placeMines(state: GameState, safeR: number, safeC: number) {
	let placed = 0;
	while (placed < state.mineCount) {
		const r = Math.floor(Math.random() * state.rows),
			c = Math.floor(Math.random() * state.cols);
		if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
		if (state.mines[r][c]) continue;
		state.mines[r][c] = true;
		placed++;
	}
	for (let r = 0; r < state.rows; r++)
		for (let c = 0; c < state.cols; c++) {
			if (state.mines[r][c]) {
				state.numbers[r][c] = -1;
				continue;
			}
			let count = 0;
			for (let dr = -1; dr <= 1; dr++)
				for (let dc = -1; dc <= 1; dc++) {
					const nr = r + dr,
						nc = c + dc;
					if (
						nr >= 0 &&
						nr < state.rows &&
						nc >= 0 &&
						nc < state.cols &&
						state.mines[nr][nc]
					)
						count++;
				}
			state.numbers[r][c] = count;
		}
}

function reveal(state: GameState, r: number, c: number): boolean {
	if (state.firstClick) {
		placeMines(state, r, c);
		state.firstClick = false;
	}
	if (state.mines[r][c]) {
		state.gameOver = true;
		return false;
	}
	const stack: [number, number][] = [[r, c]];
	while (stack.length) {
		const [cr, cc] = stack.pop()!;
		if (cr < 0 || cr >= state.rows || cc < 0 || cc >= state.cols) continue;
		if (state.cellStates[cr][cc] !== "hidden") continue;
		state.cellStates[cr][cc] = "revealed";
		if (state.numbers[cr][cc] === 0) {
			for (let dr = -1; dr <= 1; dr++)
				for (let dc = -1; dc <= 1; dc++) stack.push([cr + dr, cc + dc]);
		}
	}
	// Check win
	let hidden = 0;
	for (let rr = 0; rr < state.rows; rr++)
		for (let cc = 0; cc < state.cols; cc++)
			if (state.cellStates[rr][cc] !== "revealed") hidden++;
	if (hidden === state.mineCount) {
		state.won = true;
		state.gameOver = true;
	}
	return true;
}

const NUM_COLORS: Record<number, string> = {
	1: "34",
	2: "32",
	3: "31",
	4: "34;1",
	5: "31;1",
	6: "36",
	7: "35",
	8: "33",
};

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class MinesweeperComponent implements _Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	constructor(
		private tui: { requestRender: () => void },
		private state: GameState,
		private onClose: () => void,
		private lang: Lang,
	) {}

	updateState(s: GameState) {
		this.state = s;
		this.version++;
		this.tui.requestRender();
	}
	invalidate() {
		this.cachedWidth = 0;
	}

	handleInput(data: string): boolean {
		if (matchesKey(data, "escape")) {
			this.onClose();
			return true;
		}
		if (this.state.gameOver) {
			if (data === "r") this.onClose();
			return true;
		}
		const s = this.state;
		if (matchesKey(data, "up") && s.cursorRow > 0) s.cursorRow--;
		else if (matchesKey(data, "down") && s.cursorRow < s.rows - 1)
			s.cursorRow++;
		else if (matchesKey(data, "left") && s.cursorCol > 0) s.cursorCol--;
		else if (matchesKey(data, "right") && s.cursorCol < s.cols - 1)
			s.cursorCol++;
		else if (matchesKey(data, "return") || data === " ") {
			if (s.cellStates[s.cursorRow][s.cursorCol] === "hidden")
				reveal(s, s.cursorRow, s.cursorCol);
		} else if (data === "f" || data === "F") {
			if (s.cellStates[s.cursorRow][s.cursorCol] === "hidden")
				s.cellStates[s.cursorRow][s.cursorCol] = "flagged";
			else if (s.cellStates[s.cursorRow][s.cursorCol] === "flagged")
				s.cellStates[s.cursorRow][s.cursorCol] = "hidden";
		}
		this.version++;
		this.tui.requestRender();
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const s = this.state;
		const lines: string[] = [];
		const cellW = 3;
		const gridW = s.cols * cellW + 1;
		const offsetX = Math.max(0, Math.floor((width - gridW) / 2));

		// Title
		const minesLabel = gui("score", this.lang);
		const title = `${BOLD_CYAN("MINESWEEPER")} ${DIM(`│ ${minesLabel}: ${s.mineCount} │ ${s.rows}×${s.cols}`)}`;
		lines.push(centerPad(title, width));
		lines.push("");

		// Count remaining flags/mines
		let flags = 0;
		for (let r = 0; r < s.rows; r++)
			for (let c = 0; c < s.cols; c++)
				if (s.cellStates[r][c] === "flagged") flags++;
		const flagsLabel = gui("flagAction", this.lang);
		lines.push(centerPad(DIM(`${flagsLabel}: ${flags}/${s.mineCount}`), width));
		lines.push("");

		for (let r = 0; r < s.rows; r++) {
			let line = " ".repeat(offsetX);
			for (let c = 0; c < s.cols; c++) {
				const isCursor = r === s.cursorRow && c === s.cursorCol;
				const cs = s.cellStates[r][c];
				let content: string;
				if (s.gameOver && !s.won && s.mines[r][c] && cs !== "flagged") {
					content = isCursor ? `${BOLD_RED("[*]")}` : `${RED(" * ")}`;
				} else if (cs === "flagged") {
					content = isCursor ? `${BOLD_YELLOW("[⚑]")}` : `${YELLOW(" ⚑ ")}`;
				} else if (cs === "revealed") {
					const n = s.numbers[r][c];
					if (n === 0) content = isCursor ? `${BOLD(" · ")}` : " · ";
					else {
						const clr = NUM_COLORS[n] ?? "0";
						content = isCursor
							? `[${`\x1b[${clr}m${n}${RESET}`} ]`
							: ` ${`\x1b[${clr}m${n}${RESET}`} `;
					}
				} else {
					content = isCursor ? `${BOLD_BLUE("[░]")}` : `${DIM("░░░")}`;
				}
				line += content;
			}
			lines.push(line);
		}

		lines.push("");
		let footer: string;
		if (s.gameOver) {
			footer = s.won
				? `${BOLD_GREEN(gui("youWin", this.lang))} ${BOLD(gui("restart", this.lang))}, ${BOLD(gui("quit", this.lang))}`
				: `${BOLD_RED(gui("boom", this.lang))} ${BOLD(gui("restart", this.lang))}, ${BOLD(gui("quit", this.lang))}`;
		} else {
			const revealLabel = gui("reveal", this.lang);
			footer = `${BOLD(gui("move", this.lang))}  ${DIM("|")}  ${BOLD("ENTER")} ${revealLabel}  ${DIM("|")}  ${BOLD(gui("flag", this.lang))}  ${DIM("|")}  ${BOLD(gui("quit", this.lang))}`;
		}
		lines.push(centerPad(footer, width));
		lines.push("", DIM("─".repeat(width)));
		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// GameModule export
// ═══════════════════════════════════════════════════════════════════════════

const INTRO = {
	en: `Minesweeper - Mine Clearing

Use arrow keys to move, F to flag, ENTER to reveal a cell.
Numbers show adjacent mines. Clear all safe cells without detonating a mine!`,
	zh: `扫雷 - 地雷清除

用方向键移动，F 标记地雷，ENTER 揭开格子。
数字表示周围地雷数。揭开所有安全格且不踩雷即获胜！`,
};

const SAVE_TYPE = "minesweeper-save";

const gameMinesweeper: GameModule = {
	meta: {
		id: "minesweeper",
		name: "Minesweeper",
		description: "Don't go boom / 扫雷",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Requires interactive mode", "error");
				return;
			}

			const lang = getLang(ctx);

			// Try to restore saved state
			const entries = ctx.sessionManager.getEntries();
			let state: GameState | undefined;
			for (let i = entries.length - 1; i >= 0; i--) {
				const e = entries[i];
				if (e.type === "custom" && e.customType === SAVE_TYPE) {
					const saved = e.data as GameState | null;
					if (saved && !saved.gameOver) state = saved;
					break;
				}
			}
			if (!state) {
				const diff = (args.trim() || "easy") as Difficulty;
				state = createState(CONFIGS[diff] ? diff : "easy");
			}

			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				const comp = new MinesweeperComponent(
					tui,
					state!,
					() => {
						// Save on exit
						pi.appendEntry(SAVE_TYPE, state!);
						done(undefined);
					},
					lang,
				);
				return comp;
			});
		};

		registerMenuEntry(gameMinesweeper.meta, handler, SAVE_TYPE);
	},
};

export default gameMinesweeper;
