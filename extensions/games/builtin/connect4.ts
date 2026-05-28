/**
 * Connect Four - Drop discs to get 4 in a row (vs AI).
 *
 * Arrow keys to select column, Enter/Space to drop.
 * AI uses simple minimax with alpha-beta pruning.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey } from "@earendil-works/pi-tui";
import type { GameModule } from "../types.js";
import { type Lang, getLang, gui } from "../i18n.js";
import {
	BOLD,
	DIM,
	BOLD_RED,
	BOLD_GREEN,
	BOLD_YELLOW,
	centerPad,
} from "../ansi.js";

type _Component = Component;

// ═══════════════════════════════════════════════════════════════════════════
// Game Logic
// ═══════════════════════════════════════════════════════════════════════════

type Cell = 0 | 1 | 2; // 0=empty, 1=player(red), 2=AI(yellow)
type GameStatus = "playing" | "win_1" | "win_2" | "draw";

const ROWS = 6;
const COLS = 7;

interface GameState {
	board: Cell[][];
	selectedCol: number;
	status: GameStatus;
	currentTurn: 1 | 2;
	aiThinking: boolean;
	lastMove: [number, number] | null;
}

function createBoard(): Cell[][] {
	return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));
}

function dropPiece(board: Cell[][], col: number, player: 1 | 2): number | null {
	for (let r = ROWS - 1; r >= 0; r--) {
		if (board[r][col] === 0) {
			board[r][col] = player;
			return r;
		}
	}
	return null;
}

function checkWin(board: Cell[][], player: Cell): [number, number][] | null {
	// Horizontal
	for (let r = 0; r < ROWS; r++)
		for (let c = 0; c <= COLS - 4; c++) {
			const cells: [number, number][] = [
				[r, c],
				[r, c + 1],
				[r, c + 2],
				[r, c + 3],
			];
			if (cells.every(([rr, cc]) => board[rr][cc] === player)) return cells;
		}
	// Vertical
	for (let r = 0; r <= ROWS - 4; r++)
		for (let c = 0; c < COLS; c++) {
			const cells: [number, number][] = [
				[r, c],
				[r + 1, c],
				[r + 2, c],
				[r + 3, c],
			];
			if (cells.every(([rr, cc]) => board[rr][cc] === player)) return cells;
		}
	// Diagonal ↘
	for (let r = 0; r <= ROWS - 4; r++)
		for (let c = 0; c <= COLS - 4; c++) {
			const cells: [number, number][] = [
				[r, c],
				[r + 1, c + 1],
				[r + 2, c + 2],
				[r + 3, c + 3],
			];
			if (cells.every(([rr, cc]) => board[rr][cc] === player)) return cells;
		}
	// Diagonal ↗
	for (let r = 3; r < ROWS; r++)
		for (let c = 0; c <= COLS - 4; c++) {
			const cells: [number, number][] = [
				[r, c],
				[r - 1, c + 1],
				[r - 2, c + 2],
				[r - 3, c + 3],
			];
			if (cells.every(([rr, cc]) => board[rr][cc] === player)) return cells;
		}
	return null;
}

function isBoardFull(board: Cell[][]): boolean {
	return board[0].every((c) => c !== 0);
}

function getValidCols(board: Cell[][]): number[] {
	const cols: number[] = [];
	for (let c = 0; c < COLS; c++) if (board[0][c] === 0) cols.push(c);
	return cols;
}

// Simple evaluation
function scoreWindow(window: Cell[], player: Cell): number {
	const opp = player === 1 ? 2 : 1;
	const mine = window.filter((c) => c === player).length;
	const empty = window.filter((c) => c === 0).length;
	const theirs = window.filter((c) => c === opp).length;
	if (mine === 4) return 100;
	if (mine === 3 && empty === 1) return 5;
	if (mine === 2 && empty === 2) return 2;
	if (theirs === 3 && empty === 1) return -4;
	return 0;
}

function evaluate(board: Cell[][], player: Cell): number {
	let score = 0;
	// Center column preference
	for (let r = 0; r < ROWS; r++) if (board[r][3] === player) score += 3;
	// Horizontal
	for (let r = 0; r < ROWS; r++)
		for (let c = 0; c <= COLS - 4; c++)
			score += scoreWindow(
				[board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]],
				player,
			);
	// Vertical
	for (let r = 0; r <= ROWS - 4; r++)
		for (let c = 0; c < COLS; c++)
			score += scoreWindow(
				[board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]],
				player,
			);
	// Diags
	for (let r = 0; r <= ROWS - 4; r++)
		for (let c = 0; c <= COLS - 4; c++)
			score += scoreWindow(
				[
					board[r][c],
					board[r + 1][c + 1],
					board[r + 2][c + 2],
					board[r + 3][c + 3],
				],
				player,
			);
	for (let r = 3; r < ROWS; r++)
		for (let c = 0; c <= COLS - 4; c++)
			score += scoreWindow(
				[
					board[r][c],
					board[r - 1][c + 1],
					board[r - 2][c + 2],
					board[r - 3][c + 3],
				],
				player,
			);
	return score;
}

function minimax(
	board: Cell[][],
	depth: number,
	alpha: number,
	beta: number,
	maximizing: boolean,
): { col: number; score: number } {
	const validCols = getValidCols(board);
	const aiWin = checkWin(board, 2);
	const playerWin = checkWin(board, 1);
	if (playerWin) return { col: -1, score: -1000 };
	if (aiWin) return { col: -1, score: 1000 };
	if (isBoardFull(board)) return { col: -1, score: 0 };
	if (depth === 0) return { col: -1, score: evaluate(board, 2) };

	if (maximizing) {
		let best = { col: validCols[0], score: -Infinity };
		for (const c of validCols) {
			const b = board.map((r) => [...r]);
			dropPiece(b, c, 2);
			const result = minimax(b, depth - 1, alpha, beta, false);
			if (result.score > best.score) best = { col: c, score: result.score };
			alpha = Math.max(alpha, best.score);
			if (alpha >= beta) break;
		}
		return best;
	}
	let best = { col: validCols[0], score: Infinity };
	for (const c of validCols) {
		const b = board.map((r) => [...r]);
		dropPiece(b, c, 1);
		const result = minimax(b, depth - 1, alpha, beta, true);
		if (result.score < best.score) best = { col: c, score: result.score };
		beta = Math.min(beta, best.score);
		if (alpha >= beta) break;
	}
	return best;
}

function aiMove(board: Cell[][]): number {
	const result = minimax(board, 4, -Infinity, Infinity, true);
	return result.col;
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class ConnectFourComponent implements _Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;

	constructor(
		private tui: { requestRender: () => void },
		private state: GameState,
		private onClose: () => void,
		private onPlayerDrop: (col: number) => void,
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
		if (this.state.status !== "playing") {
			if (data === "r") this.onClose();
			return true;
		}
		if (this.state.currentTurn !== 1 || this.state.aiThinking) return true;

		if (matchesKey(data, "left") && this.state.selectedCol > 0) {
			this.state.selectedCol--;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "right") && this.state.selectedCol < COLS - 1) {
			this.state.selectedCol++;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "return") || data === " ") {
			if (this.state.board[0][this.state.selectedCol] === 0) {
				this.onPlayerDrop(this.state.selectedCol);
			}
		}
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const s = this.state;
		const lines: string[] = [];

		const titleText = " Connect Four ";
		const tLen = titleText.length;
		const bLen = Math.max(0, width - tLen);
		lines.push(
			DIM("─".repeat(Math.floor(bLen / 2))) +
				BOLD_YELLOW(titleText) +
				DIM("─".repeat(bLen - Math.floor(bLen / 2))),
		);
		lines.push("");

		// Turn indicator
		if (s.status === "playing") {
			if (s.aiThinking) {
				lines.push(
					centerPad(
						DIM(gui("thinking", this.lang).replace("Agent", "AI")),
						width,
					),
				);
			} else {
				lines.push(
					centerPad(
						`${gui("turn", this.lang)}: ${BOLD_RED(`● ${gui("you", this.lang)}`)}  ${DIM("|")}  ${BOLD_YELLOW(`● ${gui("agent", this.lang)}`)}`,
						width,
					),
				);
			}
		} else if (s.status === "win_1") {
			lines.push(centerPad(BOLD_GREEN(gui("youWin", this.lang)), width));
		} else if (s.status === "win_2") {
			lines.push(
				centerPad(
					BOLD_YELLOW(gui("aiWins", this.lang)),
					width,
				),
			);
		} else {
			lines.push(centerPad(DIM(gui("draw", this.lang)), width));
		}
		lines.push("");

		// Column selector
		if (s.status === "playing" && !s.aiThinking) {
			let selector = " ";
			for (let c = 0; c < COLS; c++) {
				const cellW = 3;
				if (c === s.selectedCol) {
					selector += BOLD_RED(" ▼ ");
				} else {
					selector += "   ";
				}
				selector += " ";
			}
			lines.push(centerPad(selector, width));
		} else {
			lines.push("");
		}

		// Board
		const winCells = new Set(
			(checkWin(s.board, 1) ?? checkWin(s.board, 2) ?? []).map(
				([r, c]) => `${r},${c}`,
			),
		);

		// Top border
		let top = "╔";
		for (let c = 0; c < COLS; c++) top += "═══" + (c < COLS - 1 ? "╤" : "");
		top += "╗";
		lines.push(centerPad(top, width));

		for (let r = 0; r < ROWS; r++) {
			let row = "║";
			for (let c = 0; c < COLS; c++) {
				const v = s.board[r][c];
				const isWin = winCells.has(`${r},${c}`);
				const isLast =
					s.lastMove !== null && s.lastMove[0] === r && s.lastMove[1] === c;
				if (v === 0) {
					row += " · ";
				} else if (v === 1) {
					const sgr = isWin ? "\x1b[32;1m" : isLast ? "\x1b[31;1m" : "\x1b[31m";
					row += ` ${sgr}●\x1b[0m `;
				} else {
					const sgr = isWin ? "\x1b[32;1m" : isLast ? "\x1b[33;1m" : "\x1b[33m";
					row += ` ${sgr}●\x1b[0m `;
				}
				row += c < COLS - 1 ? "│" : "";
			}
			row += "║";
			lines.push(centerPad(row, width));

			if (r < ROWS - 1) {
				let sep = "╟";
				for (let c = 0; c < COLS; c++) sep += "───" + (c < COLS - 1 ? "┼" : "");
				sep += "╢";
				lines.push(centerPad(sep, width));
			}
		}
		let bot = "╚";
		for (let c = 0; c < COLS; c++) bot += "═══" + (c < COLS - 1 ? "╧" : "");
		bot += "╝";
		lines.push(centerPad(bot, width));

		// Column numbers
		let nums = " ";
		for (let c = 0; c < COLS; c++) nums += ` ${c + 1}  `;
		lines.push(centerPad(DIM(nums), width));

		// Footer
		lines.push("");
		let footer: string;
		if (s.status !== "playing")
			footer = `${BOLD("R")} ${gui("restartAction", this.lang)}  ${DIM("|")}  ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
		else if (s.aiThinking)
			footer = DIM(gui("pleaseWait", this.lang));
		else
			footer = `${BOLD("←→")} ${gui("selectColumn", this.lang)}  ${DIM("|")}  ${BOLD("ENTER")} ${gui("drop", this.lang)}  ${DIM("|")}  ${BOLD("ESC")} ${gui("quit", this.lang)}`;
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
	en: `Connect Four - Drop & Connect

Use ←→ to pick a column, ENTER to drop your disc.
Get four discs in a row (horizontal, vertical, or diagonal) to win!`,
	zh: `四子棋 - 落子连珠

用 ←→ 选择列，ENTER 落子。
横、竖、斜任意方向连成四子即获胜！`,
};

const SAVE_TYPE = "connect4-save";

const gameConnectFour: GameModule = {
	meta: {
		id: "connect4",
		name: "Connect Four",
		description: "Drop discs, get 4 in a row / 落子四连珠",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Connect Four requires interactive mode", "error");
				return;
			}

			const lang = getLang(ctx);
			const state: GameState = {
				board: createBoard(),
				selectedCol: 3,
				status: "playing",
				currentTurn: 1,
				aiThinking: false,
				lastMove: null,
			};

			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				const comp = new ConnectFourComponent(
					tui,
					state,
					() => {
						pi.appendEntry(SAVE_TYPE, state);
						done(undefined);
					},
					(col) => {
						// Player drops
						const row = dropPiece(state.board, col, 1);
						if (row === null) return;
						state.lastMove = [row, col];
						if (checkWin(state.board, 1)) {
							state.status = "win_1";
							comp.updateState(state);
							return;
						}
						if (isBoardFull(state.board)) {
							state.status = "draw";
							comp.updateState(state);
							return;
						}
						state.currentTurn = 2;
						state.aiThinking = true;
						comp.updateState(state);

						// AI moves after short delay
						setTimeout(() => {
							const aiCol = aiMove(state.board);
							const aiRow = dropPiece(state.board, aiCol, 2);
							if (aiRow !== null) state.lastMove = [aiRow, aiCol];
							if (checkWin(state.board, 2)) {
								state.status = "win_2";
							} else if (isBoardFull(state.board)) {
								state.status = "draw";
							}
							state.currentTurn = 1;
							state.aiThinking = false;
							comp.updateState(state);
						}, 300);
					},
					lang,
				);
				return comp;
			});
		};

		registerMenuEntry(gameConnectFour.meta, handler, SAVE_TYPE);
	},
};

export default gameConnectFour;
