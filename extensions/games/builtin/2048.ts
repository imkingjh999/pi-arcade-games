/**
 * Game 2048 - Example of a standalone game module.
 *
 * This file demonstrates the GameModule interface.
 * It can live in ./builtin/ (bundled) or be served from a remote URL.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey } from "@earendil-works/pi-tui";
import type { GameModule, GameMeta } from "../types.js";
import {
	BOLD,
	DIM,
	BOLD_RED,
	BOLD_GREEN,
	BOLD_YELLOW,
	BOLD_CYAN,
	centerPad,
} from "../ansi.js";
import { type Lang, getLang, gui } from "../i18n.js";

type _Component = Component;

// ─── Game Logic ───────────────────────────────────────────────────────

interface GameState {
	board: number[][];
	score: number;
	gameOver: boolean;
	won: boolean;
}

function createInitialState(): GameState {
	const board = Array.from({ length: 4 }, () => Array(4).fill(0));
	addRandomTile(board);
	addRandomTile(board);
	return { board, score: 0, gameOver: false, won: false };
}

function addRandomTile(board: number[][]) {
	const empty: [number, number][] = [];
	for (let r = 0; r < 4; r++)
		for (let c = 0; c < 4; c++) if (board[r][c] === 0) empty.push([r, c]);
	if (empty.length === 0) return;
	const [r, c] = empty[Math.floor(Math.random() * empty.length)];
	board[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function slide(row: number[]): { result: number[]; score: number } {
	const filtered = row.filter((v) => v !== 0);
	const result: number[] = [];
	let score = 0;
	let i = 0;
	while (i < filtered.length) {
		if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
			const merged = filtered[i] * 2;
			result.push(merged);
			score += merged;
			i += 2;
		} else {
			result.push(filtered[i]);
			i++;
		}
	}
	while (result.length < 4) result.push(0);
	return { result, score };
}

function move(
	board: number[][],
	dir: "up" | "down" | "left" | "right",
): { board: number[][]; score: number; moved: boolean } {
	const b = board.map((r) => [...r]);
	let totalScore = 0;

	if (dir === "left" || dir === "right") {
		for (let r = 0; r < 4; r++) {
			const row = b[r].slice();
			if (dir === "right") row.reverse();
			const { result, score } = slide(row);
			if (dir === "right") result.reverse();
			totalScore += score;
			b[r] = result;
		}
	} else {
		for (let c = 0; c < 4; c++) {
			const col = [b[0][c], b[1][c], b[2][c], b[3][c]];
			if (dir === "down") col.reverse();
			const { result, score } = slide(col);
			if (dir === "down") result.reverse();
			totalScore += score;
			for (let r = 0; r < 4; r++) b[r][c] = result[r];
		}
	}

	let moved = false;
	for (let r = 0; r < 4; r++)
		for (let c = 0; c < 4; c++) if (b[r][c] !== board[r][c]) moved = true;
	return { board: b, score: totalScore, moved };
}

function canMove(board: number[][]): boolean {
	for (let r = 0; r < 4; r++)
		for (let c = 0; c < 4; c++) {
			if (board[r][c] === 0) return true;
			if (c < 3 && board[r][c] === board[r][c + 1]) return true;
			if (r < 3 && board[r][c] === board[r + 1][c]) return true;
		}
	return false;
}

const TILE_COLORS: Record<number, string> = {
	2: "37;44",
	4: "37;44;1",
	8: "37;41",
	16: "37;41;1",
	32: "37;45",
	64: "37;45;1",
	128: "37;42",
	256: "37;42;1",
	512: "37;43",
	1024: "37;43;1",
	2048: "37;46;1",
};

// ─── TUI Component ────────────────────────────────────────────────────

class G2048Component implements _Component {
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
		let dir: "up" | "down" | "left" | "right" | null = null;
		if (matchesKey(data, "up") || data === "w") dir = "up";
		else if (matchesKey(data, "down") || data === "s") dir = "down";
		else if (matchesKey(data, "left") || data === "a") dir = "left";
		else if (matchesKey(data, "right") || data === "d") dir = "right";
		if (dir) {
			const result = move(this.state.board, dir);
			if (result.moved) {
				this.state.board = result.board;
				this.state.score += result.score;
				addRandomTile(this.state.board);
				if (!canMove(this.state.board)) this.state.gameOver = true;
				if (
					this.state.board.some((r) => r.some((v) => v >= 2048)) &&
					!this.state.won
				)
					this.state.won = true;
				this.version++;
				this.tui.requestRender();
			}
		}
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const s = this.state;
		const lines: string[] = [];
		const cellW = 6;

		lines.push(
			centerPad(
				`${BOLD_CYAN("2048")} ${DIM("│")} ${gui("score", this.lang)}: ${BOLD_YELLOW(String(s.score))}`,
				width,
			),
		);
		lines.push("");

		// Top border
		let top = "╭";
		for (let c = 0; c < 4; c++) {
			top += "─".repeat(cellW);
			if (c < 3) top += "┬";
		}
		top += "╮";
		lines.push(centerPad(top, width));

		for (let r = 0; r < 4; r++) {
			let row = "│";
			for (let c = 0; c < 4; c++) {
				const v = s.board[r][c];
				if (v === 0) {
					row += DIM("  ·   ") + "│";
				} else {
					const clr = TILE_COLORS[v] || "37;46;1";
					const text = String(v);
					const pad = cellW - text.length;
					const left = Math.floor(pad / 2);
					row += `\x1b[${clr}m${" ".repeat(left)}${text}${" ".repeat(pad - left)}\x1b[0m│`;
				}
			}
			lines.push(centerPad(row, width));

			if (r < 3) {
				let sep = "├";
				for (let c = 0; c < 4; c++) {
					sep += "─".repeat(cellW);
					if (c < 3) sep += "┼";
				}
				sep += "┤";
				lines.push(centerPad(sep, width));
			}
		}

		let bot = "╰";
		for (let c = 0; c < 4; c++) {
			bot += "─".repeat(cellW);
			if (c < 3) bot += "┴";
		}
		bot += "╯";
		lines.push(centerPad(bot, width));
		lines.push("");

		let footer: string;
		if (s.gameOver)
			footer = `${BOLD_RED(gui("gameOver", this.lang))} ${gui("score", this.lang)}: ${BOLD(String(s.score))}  ${BOLD(gui("restart", this.lang))}`;
		else if (s.won)
			footer = `${BOLD_GREEN(gui("youWin", this.lang))} ${gui("keepGoing", this.lang)}  ${BOLD(gui("restart", this.lang))}  ${BOLD(gui("quit", this.lang))}`;
		else
			footer = `${gui("slide", this.lang)}  ${DIM("|")}  ${BOLD(gui("quit", this.lang))}`;
		lines.push(centerPad(footer, width));
		lines.push("", DIM("─".repeat(width)));
		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}
}

// ─── GameModule Export ─────────────────────────────────────────────────

const SAVE_TYPE = "game-2048-save";

const INTRO = {
	en: `2048 - Number Merge Puzzle

Slide tiles with arrow keys or WASD. When two tiles with the same number collide, they merge into one.
Reach the 2048 tile to win!`,
	zh: `2048 - 数字合并益智游戏

用方向键或 WASD 滑动方块。相同数字的方块碰撞时会合并。
目标是合成 2048 方块！`,
};

const game2048: GameModule = {
	meta: {
		id: "2048",
		name: "2048",
		description: "Slide & merge tiles / 滑动合并数字",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("2048 requires interactive mode", "error");
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
			if (!state) state = createInitialState();

			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				const comp = new G2048Component(
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

		registerMenuEntry(game2048.meta, handler, SAVE_TYPE);
	},
};

export default game2048;
