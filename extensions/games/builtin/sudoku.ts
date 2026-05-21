/**
 * Sudoku - Classic 9x9 number puzzle.
 *
 * Arrow keys to move, 1-9 to fill, backspace/delete to clear.
 * Generates random puzzles with three difficulty levels.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey } from "@earendil-works/pi-tui";
import type { GameModule } from "../types.js";
import { type Lang, getLang, gui } from "../i18n.js";
import {
	BOLD,
	DIM,
	BOLD_GREEN,
	BOLD_YELLOW,
	BOLD_CYAN,
	centerPad,
} from "../ansi.js";

type _Component = Component;

// ═══════════════════════════════════════════════════════════════════════════
// Game Logic
// ═══════════════════════════════════════════════════════════════════════════

type Difficulty = "easy" | "medium" | "hard";
type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface GameState {
	board: CellValue[][]; // 0 = empty
	given: boolean[][]; // true = pre-filled, not editable
	solution: CellValue[][];
	cursorRow: number;
	cursorCol: number;
	gameOver: boolean;
	startTime: number;
	elapsed: number;
	difficulty: Difficulty;
	selectingDifficulty: boolean;
	selectedDifficulty: number; // 0=easy, 1=medium, 2=hard
}

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function isValidPlacement(
	board: CellValue[][],
	row: number,
	col: number,
	num: number,
): boolean {
	for (let c = 0; c < 9; c++) if (board[row][c] === num) return false;
	for (let r = 0; r < 9; r++) if (board[r][col] === num) return false;
	const br = Math.floor(row / 3) * 3;
	const bc = Math.floor(col / 3) * 3;
	for (let r = br; r < br + 3; r++)
		for (let c = bc; c < bc + 3; c++) if (board[r][c] === num) return false;
	return true;
}

function solveSudoku(board: CellValue[][]): boolean {
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
			if (board[r][c] === 0) {
				const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
				for (const n of nums) {
					if (isValidPlacement(board, r, c, n)) {
						board[r][c] = n as CellValue;
						if (solveSudoku(board)) return true;
						board[r][c] = 0;
					}
				}
				return false;
			}
		}
	}
	return true;
}

function generatePuzzle(difficulty: Difficulty): {
	board: CellValue[][];
	solution: CellValue[][];
	given: boolean[][];
} {
	// Generate a complete solution
	const solution: CellValue[][] = Array.from({ length: 9 }, () =>
		Array(9).fill(0),
	);
	solveSudoku(solution);

	// Copy and remove cells
	const board = solution.map((r) => [...r]);
	const given = Array.from({ length: 9 }, () => Array(9).fill(true));

	const removeCounts: Record<Difficulty, number> = {
		easy: 36,
		medium: 46,
		hard: 54,
	};

	const positions = shuffle(
		Array.from(
			{ length: 81 },
			(_, i) => [Math.floor(i / 9), i % 9] as [number, number],
		),
	);

	let removed = 0;
	for (const [r, c] of positions) {
		if (removed >= removeCounts[difficulty]) break;
		board[r][c] = 0;
		given[r][c] = false;
		removed++;
	}

	return { board, solution, given };
}

function hasConflict(board: CellValue[][], row: number, col: number): boolean {
	const v = board[row][col];
	if (v === 0) return false;
	// Row
	for (let c = 0; c < 9; c++) if (c !== col && board[row][c] === v) return true;
	// Col
	for (let r = 0; r < 9; r++) if (r !== row && board[r][col] === v) return true;
	// Box
	const br = Math.floor(row / 3) * 3;
	const bc = Math.floor(col / 3) * 3;
	for (let r = br; r < br + 3; r++)
		for (let c = bc; c < bc + 3; c++)
			if ((r !== row || c !== col) && board[r][c] === v) return true;
	return false;
}

function isBoardComplete(board: CellValue[][]): boolean {
	for (let r = 0; r < 9; r++)
		for (let c = 0; c < 9; c++)
			if (board[r][c] === 0 || hasConflict(board, r, c)) return false;
	return true;
}

function createInitialState(
	difficulty: Difficulty = "medium",
	puzzle?: {
		board: CellValue[][];
		solution: CellValue[][];
		given: boolean[][];
	},
): GameState {
	const p = puzzle ?? generatePuzzle(difficulty);
	return {
		board: p.board,
		given: p.given,
		solution: p.solution,
		cursorRow: 4,
		cursorCol: 4,
		gameOver: false,
		startTime: Date.now(),
		elapsed: 0,
		difficulty,
		selectingDifficulty: true,
		selectedDifficulty: 1,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class SudokuComponent implements _Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	private timerInterval: ReturnType<typeof setInterval> | null = null;

	constructor(
		private tui: { requestRender: () => void },
		private state: GameState,
		private onClose: () => void,
		private lang: Lang,
	) {
		this.timerInterval = setInterval(() => {
			if (!state.gameOver && !state.selectingDifficulty) {
				state.elapsed = Date.now() - state.startTime;
				this.version++;
				tui.requestRender();
			}
		}, 1000);
	}

	destroy() {
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}

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
			this.destroy();
			this.onClose();
			return true;
		}

		// Difficulty selection
		if (this.state.selectingDifficulty) {
			if (matchesKey(data, "up") && this.state.selectedDifficulty > 0) {
				this.state.selectedDifficulty--;
				this.version++;
				this.tui.requestRender();
			} else if (
				matchesKey(data, "down") &&
				this.state.selectedDifficulty < 2
			) {
				this.state.selectedDifficulty++;
				this.version++;
				this.tui.requestRender();
			} else if (matchesKey(data, "return") || data === " ") {
				const diffs: Difficulty[] = ["easy", "medium", "hard"];
				const puzzle = generatePuzzle(diffs[this.state.selectedDifficulty]);
				this.state.board = puzzle.board;
				this.state.given = puzzle.given;
				this.state.solution = puzzle.solution;
				this.state.difficulty = diffs[this.state.selectedDifficulty];
				this.state.selectingDifficulty = false;
				this.state.startTime = Date.now();
				this.state.elapsed = 0;
				this.state.gameOver = false;
				this.version++;
				this.tui.requestRender();
			}
			return true;
		}

		// Game over
		if (this.state.gameOver) {
			if (data === "r") {
				this.state.selectingDifficulty = true;
				this.state.selectedDifficulty = 1;
				this.version++;
				this.tui.requestRender();
			}
			return true;
		}

		// Game play
		if (matchesKey(data, "up") && this.state.cursorRow > 0) {
			this.state.cursorRow--;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "down") && this.state.cursorRow < 8) {
			this.state.cursorRow++;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "left") && this.state.cursorCol > 0) {
			this.state.cursorCol--;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "right") && this.state.cursorCol < 8) {
			this.state.cursorCol++;
			this.version++;
			this.tui.requestRender();
		} else if (data >= "1" && data <= "9") {
			const { cursorRow: r, cursorCol: c } = this.state;
			if (!this.state.given[r][c]) {
				this.state.board[r][c] = parseInt(data) as CellValue;
				if (isBoardComplete(this.state.board)) {
					this.state.gameOver = true;
					this.state.elapsed = Date.now() - this.state.startTime;
				}
				this.version++;
				this.tui.requestRender();
			}
		} else if (
			matchesKey(data, "backspace") ||
			matchesKey(data, "delete") ||
			data === "0"
		) {
			const { cursorRow: r, cursorCol: c } = this.state;
			if (!this.state.given[r][c]) {
				this.state.board[r][c] = 0;
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

		// Title
		const titleText = " Sudoku ";
		const titleLen = titleText.length;
		const borderLen = Math.max(0, width - titleLen);
		lines.push(
			DIM("─".repeat(Math.floor(borderLen / 2))) +
				BOLD_CYAN(titleText) +
				DIM("─".repeat(borderLen - Math.floor(borderLen / 2))),
		);

		// Difficulty selection
		if (s.selectingDifficulty) {
			// Calculate left padding to align with the board
			const cellW = 1;
			const boardVisibleWidth = 1 + 9 * (cellW + 1);
			const leftPad = Math.max(0, Math.floor((width - boardVisibleWidth) / 2));

			lines.push("");
			lines.push(centerPad(BOLD(gui("selectDifficulty", this.lang)), width));
			lines.push("");
			const clueStr = gui("clues", this.lang);
			const diffs = [
				{ name: gui("easy", this.lang), desc: `45${clueStr}` },
				{ name: gui("medium", this.lang), desc: `35${clueStr}` },
				{ name: gui("hard", this.lang), desc: `27${clueStr}` },
			];
			for (let i = 0; i < 3; i++) {
				const sel = i === s.selectedDifficulty;
				const prefix = sel ? "  > " : "    ";
				const label = sel
					? BOLD_GREEN(`  ${diffs[i].name}`) + DIM(` (${diffs[i].desc})`)
					: DIM(`  ${diffs[i].name} (${diffs[i].desc})`);
				lines.push(" ".repeat(leftPad) + prefix + label);
			}
			lines.push("");
			lines.push(
				" ".repeat(leftPad) +
					`${BOLD("↑↓")} ${gui("moveAction", this.lang)}  ${DIM("|")}  ${BOLD("ENTER")} ${gui("startAction", this.lang)}`,
			);
			lines.push("", DIM("─".repeat(width)));
			this.cachedLines = lines;
			this.cachedWidth = width;
			this.cachedVersion = this.version;
			return lines;
		}

		// Timer
		const secs = Math.floor(s.elapsed / 1000);
		const mins = Math.floor(secs / 60);
		const timeStr = `${String(mins).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
		const diffLabel = gui(s.difficulty, this.lang);
		lines.push(
			centerPad(
				`${BOLD_CYAN("Sudoku")} ${DIM("│")} ${BOLD(diffLabel)} ${DIM("│")} ⏱ ${BOLD_YELLOW(timeStr)}`,
				width,
			),
		);
		lines.push("");

		// Board - compact 3×3 box borders
		const cellW = 1;
		for (let r = 0; r < 9; r++) {
			if (r % 3 === 0) {
				let border = r === 0 ? "┌" : "├";
				for (let c = 0; c < 9; c++) {
					border += "─".repeat(cellW);
					if (c < 8) border += c % 3 === 2 ? "┼" : "┬";
				}
				border += r === 0 ? "┐" : "┤";
				lines.push(centerPad(border, width));
			}

			let row = "│";
			for (let c = 0; c < 9; c++) {
				const v = s.board[r][c];
				const isGiven = s.given[r][c];
				const isCursor = r === s.cursorRow && c === s.cursorCol;
				const conflict = !isGiven && v !== 0 && hasConflict(s.board, r, c);

				let cell: string;
				if (v === 0) {
					cell = isCursor ? "\x1b[7m\x1b[1;36m·\x1b[0m" : "·";
				} else if (conflict) {
					cell = isCursor
						? `\x1b[7m\x1b[1;31m${v}\x1b[0m`
						: `\x1b[1;31m${v}\x1b[0m`;
				} else if (isGiven) {
					cell = isCursor ? `\x1b[7m\x1b[1m${v}\x1b[0m` : `\x1b[1m${v}\x1b[0m`;
				} else {
					cell = isCursor
						? `\x1b[7m\x1b[1;36m${v}\x1b[0m`
						: `\x1b[1;36m${v}\x1b[0m`;
				}

				row += cell;
				row += "│";
			}
			lines.push(centerPad(row, width));
		}

		let botBorder = "└";
		for (let c = 0; c < 9; c++) {
			botBorder += "─".repeat(cellW);
			if (c < 8) botBorder += c % 3 === 2 ? "┼" : "┴";
		}
		botBorder += "┘";
		lines.push(centerPad(botBorder, width));

		// Footer
		lines.push("");
		let footer: string;
		if (s.gameOver) {
			footer = `${BOLD_GREEN(gui("complete", this.lang))} ${BOLD_YELLOW(timeStr)}  ${BOLD("R")} ${gui("newPuzzle", this.lang)}`;
		} else {
			footer = `${BOLD("←↑↓→")} ${gui("moveAction", this.lang)}  ${DIM("|")}  ${BOLD("1-9")} ${gui("fillAction", this.lang)}  ${DIM("|")}  ${BOLD("DEL")} ${gui("clearAction", this.lang)}  ${DIM("|")}  ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
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
	en: `Sudoku - Number Puzzle

Use arrow keys to navigate, number keys 1-9 to fill cells.
Fill every row, column, and 3×3 box with numbers 1-9 without repeats.`,
	zh: `数独 - 九宫格数字推理

用方向键导航，数字键 1-9 填写格子。
每行、每列、每个 3×3 宫格都填入 1-9 且不重复。`,
};

const SAVE_TYPE = "sudoku-save";

const gameSudoku: GameModule = {
	meta: {
		id: "sudoku",
		name: "Sudoku",
		description: "9×9 number puzzle / 数独",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Sudoku requires interactive mode", "error");
				return;
			}

			const lang = getLang(ctx);
			const state: GameState = createInitialState();

			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				const comp = new SudokuComponent(
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

		registerMenuEntry(gameSudoku.meta, handler, SAVE_TYPE);
	},
};

export default gameSudoku;
