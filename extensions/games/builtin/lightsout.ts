/**
 * Lights Out - Toggle puzzle game.
 *
 * Click a cell to toggle it and its neighbors. Goal: turn all lights off.
 * Arrow keys to move, Enter/Space to toggle.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey } from "@earendil-works/pi-tui";
import type { GameModule } from "../types.js";
import { type Lang, getLang, gui } from "../i18n.js";
import {
	BOLD,
	DIM,
	BOLD_RED,
	BOLD_GREEN,
	BOLD_YELLOW,
	BOLD_CYAN,
	centerPad,
} from "../ansi.js";

type _Component = Component;

// ═══════════════════════════════════════════════════════════════════════════
// Game Logic
// ═══════════════════════════════════════════════════════════════════════════

interface GameState {
	grid: boolean[][]; // true = lit, false = off
	size: number;
	cursorRow: number;
	cursorCol: number;
	moves: number;
	gameOver: boolean;
	selectingSize: boolean;
	selectedSize: number; // 0=3x3, 1=4x4, 2=5x5
	startTime: number;
	elapsed: number;
}

function toggleCell(
	grid: boolean[][],
	row: number,
	col: number,
	size: number,
): void {
	const dirs = [
		[0, 0],
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
	];
	for (const [dr, dc] of dirs) {
		const r = row + dr;
		const c = col + dc;
		if (r >= 0 && r < size && c >= 0 && c < size) {
			grid[r][c] = !grid[r][c];
		}
	}
}

function generatePuzzle(size: number): boolean[][] {
	// Start from all-off and make random moves (ensures solvability)
	const grid = Array.from({ length: size }, () => Array(size).fill(false));
	const numMoves = size * size; // enough random toggles
	for (let i = 0; i < numMoves; i++) {
		const r = Math.floor(Math.random() * size);
		const c = Math.floor(Math.random() * size);
		toggleCell(grid, r, c, size);
	}
	// Make sure at least some lights are on
	if (grid.every((row) => row.every((cell) => !cell))) {
		toggleCell(grid, Math.floor(size / 2), Math.floor(size / 2), size);
	}
	return grid;
}

function isAllOff(grid: boolean[][]): boolean {
	return grid.every((row) => row.every((cell) => !cell));
}

function countLit(grid: boolean[][]): number {
	return grid.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

function createInitialState(): GameState {
	return {
		grid: [],
		size: 5,
		cursorRow: 2,
		cursorCol: 2,
		moves: 0,
		gameOver: false,
		selectingSize: true,
		selectedSize: 2,
		startTime: Date.now(),
		elapsed: 0,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class LightsOutComponent implements _Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	private timerInterval: ReturnType<typeof setInterval> | null = null;
	private lang: Lang;

	constructor(
		private tui: { requestRender: () => void },
		private state: GameState,
		private onClose: () => void,
		lang: Lang,
	) {
		this.lang = lang;
		this.timerInterval = setInterval(() => {
			if (!state.gameOver && !state.selectingSize) {
				state.elapsed = Date.now() - state.startTime;
				this.version++;
				tui.requestRender();
			}
		}, 1000);
	}

	destroy() {
		if (this.timerInterval) clearInterval(this.timerInterval);
	}

	updateState() {
		this.version++;
		this.tui.requestRender();
	}
	invalidate() {
		this.cachedWidth = 0;
	}

	handleInput(data: string): boolean {
		if (matchesKey(data, "escape")) {
			this.destroy();
			this.onClose();
			return true;
		}
		const s = this.state;

		if (s.selectingSize) {
			if (matchesKey(data, "up") && s.selectedSize > 0) {
				s.selectedSize--;
				this.updateState();
			} else if (matchesKey(data, "down") && s.selectedSize < 2) {
				s.selectedSize++;
				this.updateState();
			} else if (matchesKey(data, "return") || data === " ") {
				const sizes = [3, 4, 5];
				s.size = sizes[s.selectedSize];
				s.grid = generatePuzzle(s.size);
				s.cursorRow = Math.floor(s.size / 2);
				s.cursorCol = Math.floor(s.size / 2);
				s.moves = 0;
				s.gameOver = false;
				s.selectingSize = false;
				s.startTime = Date.now();
				s.elapsed = 0;
				this.updateState();
			}
			return true;
		}

		if (s.gameOver) {
			if (data === "r") {
				s.selectingSize = true;
				this.updateState();
			}
			return true;
		}

		if (matchesKey(data, "up") && s.cursorRow > 0) {
			s.cursorRow--;
			this.updateState();
		} else if (matchesKey(data, "down") && s.cursorRow < s.size - 1) {
			s.cursorRow++;
			this.updateState();
		} else if (matchesKey(data, "left") && s.cursorCol > 0) {
			s.cursorCol--;
			this.updateState();
		} else if (matchesKey(data, "right") && s.cursorCol < s.size - 1) {
			s.cursorCol++;
			this.updateState();
		} else if (matchesKey(data, "return") || data === " ") {
			toggleCell(s.grid, s.cursorRow, s.cursorCol, s.size);
			s.moves++;
			if (isAllOff(s.grid)) {
				s.gameOver = true;
				s.elapsed = Date.now() - s.startTime;
			}
			this.updateState();
		}
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const s = this.state;
		const lines: string[] = [];

		const titleText = " Lights Out ";
		const tLen = titleText.length;
		const bLen = Math.max(0, width - tLen);
		lines.push(
			DIM("─".repeat(Math.floor(bLen / 2))) +
				BOLD_YELLOW(titleText) +
				DIM("─".repeat(bLen - Math.floor(bLen / 2))),
		);

		if (s.selectingSize) {
			lines.push("");
			lines.push(centerPad(BOLD(gui("selectDifficulty", this.lang)), width));
			lines.push("");
			const sizes = [
				{ name: "3×3", desc: gui("easy", this.lang) },
				{ name: "4×4", desc: gui("medium", this.lang) },
				{ name: "5×5", desc: gui("hard", this.lang) },
			];

			// Calculate left padding to align with board
			const estCellW = 4;
			const estBoardWidth = 5 * estCellW + 6;
			const leftPad = Math.max(0, Math.floor((width - estBoardWidth) / 2));

			for (let i = 0; i < 3; i++) {
				const sel = i === s.selectedSize;
				const prefix = sel ? "  > " : "    ";
				const label = sel
					? BOLD_GREEN(`  ${sizes[i].name}`) + DIM(` (${sizes[i].desc})`)
					: DIM(`  ${sizes[i].name} (${sizes[i].desc})`);
				lines.push(" ".repeat(leftPad) + prefix + label);
			}
			lines.push("");
			lines.push(
				" ".repeat(leftPad) +
					`${BOLD("↑↓")} ${gui("selectAction", this.lang)}  ${DIM("|")}  ${BOLD("ENTER")} ${gui("startAction", this.lang)}`,
			);
			lines.push("", DIM("─".repeat(width)));
			this.cachedLines = lines;
			this.cachedWidth = width;
			this.cachedVersion = this.version;
			return lines;
		}

		const secs = Math.floor(s.elapsed / 1000);
		const mins = Math.floor(secs / 60);
		const timeStr = `${String(mins).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
		const lit = countLit(s.grid);

		const litLabel = gui("left", this.lang);
		lines.push(
			centerPad(
				`${BOLD_YELLOW("💡")} ${lit} ${litLabel}  ${DIM("|")} ${gui("moves", this.lang)}: ${BOLD(String(s.moves))} ${DIM("|")} ⏱ ${BOLD_YELLOW(timeStr)}`,
				width,
			),
		);
		lines.push("");

		// Board
		const cellW = 4;
		const seg = "══".repeat(cellW / 2);

		// Helper: build a horizontal border row with optional cursor highlight
		const buildHBorder = (
			left: string,
			mid: string,
			right: string,
			highlight: boolean,
		) => {
			let line = "";
			for (let c = 0; c < s.size; c++) {
				if (c === 0) {
					line += highlight && s.cursorCol === 0 ? BOLD_YELLOW(left) : left;
				} else {
					const hlJoint =
						highlight && (c === s.cursorCol || c - 1 === s.cursorCol);
					line += hlJoint ? BOLD_YELLOW(mid) : mid;
				}
				line += highlight && c === s.cursorCol ? BOLD_YELLOW(seg) : seg;
			}
			line +=
				highlight && s.cursorCol === s.size - 1 ? BOLD_YELLOW(right) : right;
			return line;
		};

		// Top border (highlight if cursor is in first row)
		lines.push(
			centerPad(buildHBorder("╔", "╦", "╗", s.cursorRow === 0), width),
		);

		for (let r = 0; r < s.size; r++) {
			const isCurRow = r === s.cursorRow;
			let row = isCurRow && s.cursorCol === 0 ? BOLD_YELLOW("║") : "║";
			for (let c = 0; c < s.size; c++) {
				const lit2 = s.grid[r][c];
				// Cell content — no cursor effect, always show lit/dark state
				if (lit2) {
					row += `\x1b[33;1m${"█".repeat(cellW)}\x1b[0m`;
				} else {
					row += DIM("░".repeat(cellW));
				}
				// Separator between cells: highlight if adjacent to cursor cell
				if (c < s.size - 1) {
					const adjCursor =
						isCurRow && (c === s.cursorCol || c + 1 === s.cursorCol);
					row += adjCursor ? BOLD_YELLOW("║") : "║";
				}
			}
			row += isCurRow && s.cursorCol === s.size - 1 ? BOLD_YELLOW("║") : "║";
			lines.push(centerPad(row, width));

			if (r < s.size - 1) {
				// Separator: highlight if adjacent to cursor row
				const hlSep = r === s.cursorRow || r + 1 === s.cursorRow;
				lines.push(centerPad(buildHBorder("╠", "╬", "╣", hlSep), width));
			}
		}
		// Bottom border (highlight if cursor is in last row)
		lines.push(
			centerPad(buildHBorder("╚", "╩", "╝", s.cursorRow === s.size - 1), width),
		);

		// Footer
		lines.push("");
		let footer: string;
		if (s.gameOver) {
			footer = `${BOLD_GREEN(gui("allLightsOut", this.lang))} ${BOLD(String(s.moves))} ${gui("movesAction", this.lang)}  ${BOLD("R")} ${gui("newPuzzle", this.lang)}`;
		} else {
			footer = `${gui("move", this.lang)}  ${DIM("|")}  ${BOLD("ENTER")} ${gui("toggle", this.lang)}  ${DIM("|")}  ${gui("turnAllOff", this.lang)}  ${DIM("|")}  ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
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
// GameModule Export
// ═══════════════════════════════════════════════════════════════════════════

const INTRO = {
	en: `Lights Out - Toggle Puzzle

Use arrow keys to move cursor, ENTER to toggle a light and its neighbors.
Turn all lights off to win!`,
	zh: `关灯游戏 - 开关谜题

用方向键移动光标，ENTER 切换一盏灯及其相邻灯的状态。
关灭所有灯即获胜！`,
};

const SAVE_TYPE = "lightsout-save";

const gameLightsOut: GameModule = {
	meta: {
		id: "lightsout",
		name: "Lights Out",
		description: "Toggle all lights off / 关灭所有灯",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Lights Out requires interactive mode", "error");
				return;
			}

			const lang = getLang(ctx);
			const state = createInitialState();

			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				const comp = new LightsOutComponent(
					tui,
					state,
					() => {
						pi.appendEntry(SAVE_TYPE, state);
						done(undefined);
					},
					lang,
				);
				return comp;
			});
		};

		registerMenuEntry(gameLightsOut.meta, handler, SAVE_TYPE);
	},
};

export default gameLightsOut;
