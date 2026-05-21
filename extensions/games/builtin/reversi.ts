/**
 * Reversi / Othello - Classic 8x8 strategy board game vs AI.
 *
 * Arrow keys to move cursor, Enter/Space to place.
 * AI uses positional evaluation with minimax (depth 3).
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey } from "@earendil-works/pi-tui";
import type { GameModule } from "../types.js";
import { type Lang, getLang, gui } from "../i18n.js";
import { BOLD, DIM, BOLD_GREEN, BOLD_YELLOW, centerPad } from "../ansi.js";

type _Component = Component;

// ═══════════════════════════════════════════════════════════════════════════
// Game Logic
// ═══════════════════════════════════════════════════════════════════════════

type Cell = 0 | 1 | 2; // 0=empty, 1=black(player), 2=white(AI)

const SIZE = 8;
const DIRS = [
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[0, -1],
	[0, 1],
	[1, -1],
	[1, 0],
	[1, 1],
];

interface GameState {
	board: Cell[][];
	cursorRow: number;
	cursorCol: number;
	currentTurn: 1 | 2;
	status: "playing" | "win_1" | "win_2" | "draw";
	aiThinking: boolean;
	lastMove: [number, number] | null;
}

function createBoard(): Cell[][] {
	const b: Cell[][] = Array.from({ length: SIZE }, () =>
		Array<Cell>(SIZE).fill(0),
	);
	b[3][3] = 2;
	b[3][4] = 1;
	b[4][3] = 1;
	b[4][4] = 2;
	return b;
}

function getFlips(
	board: Cell[][],
	row: number,
	col: number,
	player: 1 | 2,
): [number, number][] {
	if (board[row][col] !== 0) return [];
	const opp = player === 1 ? 2 : 1;
	const allFlips: [number, number][] = [];
	for (const [dr, dc] of DIRS) {
		const flips: [number, number][] = [];
		let r = row + dr;
		let c = col + dc;
		while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r][c] === opp) {
			flips.push([r, c]);
			r += dr;
			c += dc;
		}
		if (
			flips.length > 0 &&
			r >= 0 &&
			r < SIZE &&
			c >= 0 &&
			c < SIZE &&
			board[r][c] === player
		) {
			allFlips.push(...flips);
		}
	}
	return allFlips;
}

function getValidMoves(board: Cell[][], player: 1 | 2): [number, number][] {
	const moves: [number, number][] = [];
	for (let r = 0; r < SIZE; r++)
		for (let c = 0; c < SIZE; c++)
			if (getFlips(board, r, c, player).length > 0) moves.push([r, c]);
	return moves;
}

function applyMove(
	board: Cell[][],
	row: number,
	col: number,
	player: 1 | 2,
): Cell[][] {
	const b = board.map((r) => [...r]) as Cell[][];
	const flips = getFlips(board, row, col, player);
	b[row][col] = player;
	for (const [fr, fc] of flips) b[fr][fc] = player;
	return b;
}

function countPieces(board: Cell[][]): { p1: number; p2: number } {
	let p1 = 0;
	let p2 = 0;
	for (let r = 0; r < SIZE; r++)
		for (let c = 0; c < SIZE; c++) {
			if (board[r][c] === 1) p1++;
			else if (board[r][c] === 2) p2++;
		}
	return { p1, p2 };
}

// Positional weights for evaluation
const WEIGHTS = [
	[100, -20, 10, 5, 5, 10, -20, 100],
	[-20, -50, -2, -2, -2, -2, -50, -20],
	[10, -2, 1, 1, 1, 1, -2, 10],
	[5, -2, 1, 0, 0, 1, -2, 5],
	[5, -2, 1, 0, 0, 1, -2, 5],
	[10, -2, 1, 1, 1, 1, -2, 10],
	[-20, -50, -2, -2, -2, -2, -50, -20],
	[100, -20, 10, 5, 5, 10, -20, 100],
];

function evaluate(board: Cell[][]): number {
	let score = 0;
	for (let r = 0; r < SIZE; r++)
		for (let c = 0; c < SIZE; c++) {
			if (board[r][c] === 2) score += WEIGHTS[r][c];
			else if (board[r][c] === 1) score -= WEIGHTS[r][c];
		}
	// Mobility bonus
	score +=
		(getValidMoves(board, 2).length - getValidMoves(board, 1).length) * 5;
	return score;
}

function minimax(
	board: Cell[][],
	depth: number,
	alpha: number,
	beta: number,
	maximizing: boolean,
): number {
	const p1Moves = getValidMoves(board, 1);
	const p2Moves = getValidMoves(board, 2);

	if (depth === 0 || (p1Moves.length === 0 && p2Moves.length === 0)) {
		return evaluate(board);
	}

	if (maximizing) {
		const moves = p2Moves;
		if (moves.length === 0)
			return minimax(board, depth - 1, alpha, beta, false);
		let best = -Infinity;
		for (const [r, c] of moves) {
			const nb = applyMove(board, r, c, 2);
			const val = minimax(nb, depth - 1, alpha, beta, false);
			best = Math.max(best, val);
			alpha = Math.max(alpha, val);
			if (beta <= alpha) break;
		}
		return best;
	}
	const moves = p1Moves;
	if (moves.length === 0) return minimax(board, depth - 1, alpha, beta, true);
	let best = Infinity;
	for (const [r, c] of moves) {
		const nb = applyMove(board, r, c, 1);
		const val = minimax(nb, depth - 1, alpha, beta, true);
		best = Math.min(best, val);
		beta = Math.min(beta, val);
		if (beta <= alpha) break;
	}
	return best;
}

function aiMove(board: Cell[][]): [number, number] | null {
	const moves = getValidMoves(board, 2);
	if (moves.length === 0) return null;
	let bestScore = -Infinity;
	let bestMove = moves[0];
	for (const [r, c] of moves) {
		const nb = applyMove(board, r, c, 2);
		const score = minimax(nb, 3, -Infinity, Infinity, false);
		if (score > bestScore) {
			bestScore = score;
			bestMove = [r, c];
		}
	}
	return bestMove;
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class ReversiComponent implements _Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;

	constructor(
		private tui: { requestRender: () => void },
		private state: GameState,
		private onClose: () => void,
		private onPlayerMove: (row: number, col: number) => void,
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
		// Allow cursor movement even during AI turn
		if (matchesKey(data, "up") && this.state.cursorRow > 0) {
			this.state.cursorRow--;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "down") && this.state.cursorRow < SIZE - 1) {
			this.state.cursorRow++;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "left") && this.state.cursorCol > 0) {
			this.state.cursorCol--;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "right") && this.state.cursorCol < SIZE - 1) {
			this.state.cursorCol++;
			this.version++;
			this.tui.requestRender();
		} else if (
			this.state.currentTurn === 1 &&
			!this.state.aiThinking &&
			(matchesKey(data, "return") || data === " ")
		) {
			const { cursorRow: r, cursorCol: c } = this.state;
			if (getFlips(this.state.board, r, c, 1).length > 0) {
				this.onPlayerMove(r, c);
			}
		}
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const s = this.state;
		const lines: string[] = [];

		const titleText = " Reversi ";
		const tLen = titleText.length;
		const bLen = Math.max(0, width - tLen);
		lines.push(
			DIM("─".repeat(Math.floor(bLen / 2))) +
				BOLD_GREEN(titleText) +
				DIM("─".repeat(bLen - Math.floor(bLen / 2))),
		);
		lines.push("");

		const counts = countPieces(s.board);
		const validMoves =
			s.status === "playing" && s.currentTurn === 1
				? new Set(getValidMoves(s.board, 1).map(([r, c]) => `${r},${c}`))
				: new Set<string>();

		// Score
		if (s.status === "playing") {
			const turnLabel = s.aiThinking
				? DIM(gui("thinking", this.lang).replace("Agent", "AI"))
				: s.currentTurn === 1
					? `${BOLD("●")} ${gui("turn", this.lang)}`
					: `${BOLD_YELLOW("●")} ${gui("turn", this.lang)}`;
			lines.push(
				centerPad(
					`${BOLD(`● ${counts.p1}`)}  ${DIM("|")}  ${turnLabel}  ${DIM("|")}  ${BOLD_YELLOW(`● ${counts.p2}`)}`,
					width,
				),
			);
		} else {
			const result =
				s.status === "win_1"
					? BOLD_GREEN(gui("youWin", this.lang))
					: s.status === "win_2"
						? BOLD_YELLOW(gui("aiWins", this.lang))
						: DIM(gui("draw", this.lang));
			lines.push(
				centerPad(
					`${BOLD(`● ${counts.p1}`)}  ${DIM("|")}  ${result}  ${DIM("|")}  ${BOLD_YELLOW(`● ${counts.p2}`)}`,
					width,
				),
			);
		}
		lines.push("");

		// Board

		// Column labels
		let colLabels = "  ";
		for (let c = 0; c < SIZE; c++)
			colLabels += ` ${String.fromCharCode(65 + c)} `;
		lines.push(centerPad(DIM(colLabels), width));

		for (let r = 0; r < SIZE; r++) {
			let row = `${DIM(String(r + 1))} `;
			for (let c = 0; c < SIZE; c++) {
				const v = s.board[r][c];
				const isCursor = r === s.cursorRow && c === s.cursorCol;
				const isValid = validMoves.has(`${r},${c}`);
				const isLast = s.lastMove && s.lastMove[0] === r && s.lastMove[1] === c;

				if (v === 0) {
					if (isCursor && isValid) row += BOLD_GREEN(" + ");
					else if (isCursor) row += BOLD_GREEN(" · ");
					else if (isValid) row += DIM(" + ");
					else row += " · ";
				} else if (v === 1) {
					if (isCursor) row += BOLD("[X]");
					else if (isLast) row += " * ";
					else row += " X ";
				} else {
					if (isCursor) row += BOLD("[O]");
					else if (isLast) row += " * ";
					else row += " O ";
				}
			}
			lines.push(centerPad(row, width));
		}

		// Footer
		lines.push("");
		let footer: string;
		if (s.status !== "playing")
			footer = `${BOLD("R")} ${gui("restartAction", this.lang)}  ${DIM("|")}  ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
		else if (s.aiThinking) footer = DIM(gui("pleaseWait", this.lang));
		else
			footer = `${BOLD("←↑↓→")} ${gui("moveAction", this.lang)}  ${DIM("|")}  ${BOLD("ENTER")} ${gui("placeAction", this.lang)}  ${DIM("|")}  ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
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
	en: `Reversi - Othello Strategy

Use arrow keys to move cursor, ENTER to place your piece.
Outflank opponent pieces to flip them. Most pieces wins!`,
	zh: `黑白棋 - 翻转策略对弈

用方向键移动光标，ENTER 落子。
夹住对方棋子即可翻转，棋子多者获胜！`,
};

const SAVE_TYPE = "reversi-save";

const gameReversi: GameModule = {
	meta: {
		id: "reversi",
		name: "Reversi",
		description: "Othello strategy game / 黑白棋策略",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Reversi requires interactive mode", "error");
				return;
			}

			const lang = getLang(ctx);

			const state: GameState = {
				board: createBoard(),
				cursorRow: 2,
				cursorCol: 2,
				currentTurn: 1,
				status: "playing",
				aiThinking: false,
				lastMove: null,
			};

			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				const comp = new ReversiComponent(
					tui,
					state,
					() => {
						pi.appendEntry(SAVE_TYPE, state);
						done(undefined);
					},
					(row, col) => {
						state.board = applyMove(state.board, row, col, 1);
						state.lastMove = [row, col];
						if (getValidMoves(state.board, 2).length === 0) {
							if (getValidMoves(state.board, 1).length === 0) {
								const { p1, p2 } = countPieces(state.board);
								state.status = p1 > p2 ? "win_1" : p2 > p1 ? "win_2" : "draw";
								comp.updateState(state);
								return;
							}
							// AI passes, player goes again
							comp.updateState(state);
							return;
						}
						state.currentTurn = 2;
						state.aiThinking = true;
						comp.updateState(state);

						setTimeout(() => {
							const move = aiMove(state.board);
							if (move) {
								state.board = applyMove(state.board, move[0], move[1], 2);
								state.lastMove = move;
							}
							// Check if player can move
							if (getValidMoves(state.board, 1).length === 0) {
								if (getValidMoves(state.board, 2).length === 0) {
									const { p1, p2 } = countPieces(state.board);
									state.status = p1 > p2 ? "win_1" : p2 > p1 ? "win_2" : "draw";
									comp.updateState(state);
									return;
								}
								// Player passes, AI goes again - loop
								state.aiThinking = true;
								comp.updateState(state);
								setTimeout(() => {
									const move2 = aiMove(state.board);
									if (move2) {
										state.board = applyMove(state.board, move2[0], move2[1], 2);
										state.lastMove = move2;
									}
									state.currentTurn = 1;
									state.aiThinking = false;
									if (
										getValidMoves(state.board, 1).length === 0 &&
										getValidMoves(state.board, 2).length === 0
									) {
										const { p1, p2 } = countPieces(state.board);
										state.status =
											p1 > p2 ? "win_1" : p2 > p1 ? "win_2" : "draw";
									}
									comp.updateState(state);
								}, 300);
								return;
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

		registerMenuEntry(gameReversi.meta, handler, SAVE_TYPE);
	},
};

export default gameReversi;
