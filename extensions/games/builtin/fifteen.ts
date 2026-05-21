/**
 * Fifteen Puzzle - Classic 4x4 sliding tile puzzle.
 *
 * Arrow keys to slide tiles into the empty space.
 * Goal: arrange numbers 1-15 in order.
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

const SIZE = 4;
const EMPTY = 0;

interface GameState {
	board: number[][];
	emptyRow: number;
	emptyCol: number;
	moves: number;
	gameOver: boolean;
	startTime: number;
	elapsed: number;
	selectingSize: boolean;
	selectedSize: number; // 0=3x3, 1=4x4, 2=5x5
	gridSize: number;
}

function createSolvedBoard(size: number): number[][] {
	const board: number[][] = [];
	let n = 1;
	for (let r = 0; r < size; r++) {
		board.push([]);
		for (let c = 0; c < size; c++) {
			board[r].push(n);
			n++;
		}
	}
	board[size - 1][size - 1] = 0;
	return board;
}

function shuffleBoard(board: number[][], size: number): number[][] {
	// Shuffle by making random valid moves (ensures solvability)
	const b = board.map((r) => [...r]);
	let emptyR = size - 1;
	let emptyC = size - 1;
	const moves = size * size * 40; // plenty of shuffles
	const dirs = [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
	];
	for (let i = 0; i < moves; i++) {
		const valid = dirs.filter(([dr, dc]) => {
			const nr = emptyR + dr;
			const nc = emptyC + dc;
			return nr >= 0 && nr < size && nc >= 0 && nc < size;
		});
		const [dr, dc] = valid[Math.floor(Math.random() * valid.length)];
		const nr = emptyR + dr;
		const nc = emptyC + dc;
		b[emptyR][emptyC] = b[nr][nc];
		b[nr][nc] = 0;
		emptyR = nr;
		emptyC = nc;
	}
	return b;
}

function isSolved(board: number[][], size: number): boolean {
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

function findEmpty(board: number[][], size: number): [number, number] {
	for (let r = 0; r < size; r++)
		for (let c = 0; c < size; c++) if (board[r][c] === 0) return [r, c];
	return [size - 1, size - 1];
}

function createInitialState(size: number = 4): GameState {
	const solved = createSolvedBoard(size);
	const board = shuffleBoard(solved, size);
	const [er, ec] = findEmpty(board, size);
	return {
		board,
		emptyRow: er,
		emptyCol: ec,
		moves: 0,
		gameOver: false,
		startTime: Date.now(),
		elapsed: 0,
		selectingSize: true,
		selectedSize: 1,
		gridSize: size,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class FifteenPuzzleComponent implements _Component {
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

		if (this.state.selectingSize) {
			if (matchesKey(data, "up") && this.state.selectedSize > 0) {
				this.state.selectedSize--;
				this.version++;
				this.tui.requestRender();
			} else if (matchesKey(data, "down") && this.state.selectedSize < 2) {
				this.state.selectedSize++;
				this.version++;
				this.tui.requestRender();
			} else if (matchesKey(data, "return") || data === " ") {
				const sizes = [3, 4, 5];
				const size = sizes[this.state.selectedSize];
				const solved = createSolvedBoard(size);
				const board = shuffleBoard(solved, size);
				const [er, ec] = findEmpty(board, size);
				this.state.board = board;
				this.state.gridSize = size;
				this.state.emptyRow = er;
				this.state.emptyCol = ec;
				this.state.moves = 0;
				this.state.gameOver = false;
				this.state.selectingSize = false;
				this.state.startTime = Date.now();
				this.state.elapsed = 0;
				this.version++;
				this.tui.requestRender();
			}
			return true;
		}

		if (this.state.gameOver) {
			if (data === "r") {
				this.state.selectingSize = true;
				this.version++;
				this.tui.requestRender();
			}
			return true;
		}

		const s = this.state;
		const size = s.gridSize;
		// Arrow keys move the tile INTO the empty space
		// So pressing UP moves the tile below the empty space up
		let moved = false;
		if (matchesKey(data, "up") && s.emptyRow < size - 1) {
			s.board[s.emptyRow][s.emptyCol] = s.board[s.emptyRow + 1][s.emptyCol];
			s.board[s.emptyRow + 1][s.emptyCol] = 0;
			s.emptyRow++;
			moved = true;
		} else if (matchesKey(data, "down") && s.emptyRow > 0) {
			s.board[s.emptyRow][s.emptyCol] = s.board[s.emptyRow - 1][s.emptyCol];
			s.board[s.emptyRow - 1][s.emptyCol] = 0;
			s.emptyRow--;
			moved = true;
		} else if (matchesKey(data, "left") && s.emptyCol < size - 1) {
			s.board[s.emptyRow][s.emptyCol] = s.board[s.emptyRow][s.emptyCol + 1];
			s.board[s.emptyRow][s.emptyCol + 1] = 0;
			s.emptyCol++;
			moved = true;
		} else if (matchesKey(data, "right") && s.emptyCol > 0) {
			s.board[s.emptyRow][s.emptyCol] = s.board[s.emptyRow][s.emptyCol - 1];
			s.board[s.emptyRow][s.emptyCol - 1] = 0;
			s.emptyCol--;
			moved = true;
		}
		if (moved) {
			s.moves++;
			if (isSolved(s.board, size)) {
				s.gameOver = true;
				s.elapsed = Date.now() - s.startTime;
			}
			this.version++;
			this.tui.requestRender();
		}
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const s = this.state;
		const lines: string[] = [];

		const titleText = " Sliding Puzzle ";
		const tLen = titleText.length;
		const bLen = Math.max(0, width - tLen);
		lines.push(
			DIM("─".repeat(Math.floor(bLen / 2))) +
				BOLD_CYAN(titleText) +
				DIM("─".repeat(bLen - Math.floor(bLen / 2))),
		);

		if (s.selectingSize) {
			lines.push("");
			lines.push(centerPad(BOLD(gui("selectDifficulty", this.lang)), width));
			lines.push("");
			const sizes = [
				{ name: "3×3 (8-puzzle)", desc: gui("easy", this.lang) },
				{ name: "4×4 (15-puzzle)", desc: gui("classic", this.lang) },
				{ name: "5×5 (24-puzzle)", desc: gui("hard", this.lang) },
			];

			// Calculate left padding to align with board
			const boardSizeMax = 5; // 5×5 largest
			const estCellW = Math.max(
				3,
				Math.min(5, Math.floor((width - 4) / boardSizeMax)),
			);
			const estBoardWidth = boardSizeMax * estCellW + 2;
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

		const size = s.gridSize;
		const secs = Math.floor(s.elapsed / 1000);
		const mins = Math.floor(secs / 60);
		const timeStr = `${String(mins).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

		lines.push(
			centerPad(
				`${BOLD_CYAN(`${size}×${size}`)} ${DIM("│")} ${gui("moves", this.lang)}: ${BOLD_YELLOW(String(s.moves))} ${DIM("│")} ⏱ ${BOLD_YELLOW(timeStr)}`,
				width,
			),
		);
		lines.push("");

		// Calculate expected position for highlighting
		const cellW = Math.max(3, Math.min(5, Math.floor((width - 4) / size)));

		// Board
		let top = "╔";
		for (let c = 0; c < size; c++)
			top += "═".repeat(cellW) + (c < size - 1 ? "╦" : "");
		top += "╗";
		lines.push(centerPad(top, width));

		for (let r = 0; r < size; r++) {
			let row = "║";
			for (let c = 0; c < size; c++) {
				const v = s.board[r][c];
				if (v === 0) {
					row += DIM(" ".repeat(cellW));
				} else {
					const correctPos = v - 1;
					const targetR = Math.floor(correctPos / size);
					const targetC = correctPos % size;
					const isCorrect = r === targetR && c === targetC;
					const text = String(v);
					const pad = cellW - text.length;
					const left = Math.floor(pad / 2);
					if (isCorrect) {
						row += `${" ".repeat(left)}\x1b[32;1m${text}\x1b[0m${" ".repeat(pad - left)}`;
					} else {
						row += `${" ".repeat(left)}\x1b[37;1m${text}\x1b[0m${" ".repeat(pad - left)}`;
					}
				}
				row += c < size - 1 ? "║" : "";
			}
			row += "║";
			lines.push(centerPad(row, width));

			if (r < size - 1) {
				let sep = "╠";
				for (let c = 0; c < size; c++)
					sep += "═".repeat(cellW) + (c < size - 1 ? "╬" : "");
				sep += "╣";
				lines.push(centerPad(sep, width));
			}
		}
		let bot = "╚";
		for (let c = 0; c < size; c++)
			bot += "═".repeat(cellW) + (c < size - 1 ? "╩" : "");
		bot += "╝";
		lines.push(centerPad(bot, width));

		// Footer
		lines.push("");
		let footer: string;
		if (s.gameOver) {
			footer = `${BOLD_GREEN(gui("solved", this.lang))} ${BOLD_YELLOW(String(s.moves))} ${gui("movesAction", this.lang)}, ${timeStr}  ${BOLD("R")} ${gui("newPuzzle", this.lang)}`;
		} else {
			footer = `${BOLD("←↑↓→")} ${gui("slideTiles", this.lang)}  ${DIM("|")}  ${BOLD_GREEN(gui("greenLabel", this.lang))} = ${gui("correctPos", this.lang)}  ${DIM("|")}  ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
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
	en: `Sliding Puzzle - Arrange the Tiles

Use arrow keys to slide tiles into the empty space.
Arrange all numbers 1-15 in order to solve the puzzle.`,
	zh: `华容道 - 滑块排序

用方向键将方块滑入空位。
将数字 1-15 按顺序排列即可过关。`,
};

const SAVE_TYPE = "fifteen-save";

const gameFifteen: GameModule = {
	meta: {
		id: "fifteen",
		name: "Sliding Puzzle",
		description: "Arrange tiles in order / 滑块排序",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Sliding Puzzle requires interactive mode", "error");
				return;
			}

			const lang = getLang(ctx);
			const state = createInitialState();

			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				const comp = new FifteenPuzzleComponent(
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

		registerMenuEntry(gameFifteen.meta, handler, SAVE_TYPE);
	},
};

export default gameFifteen;
