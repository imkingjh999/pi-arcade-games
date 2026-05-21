/**
 * Tetris - Stack falling blocks, clear lines.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	type Component,
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import type { GameModule, GameMeta } from "../types.js";
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
import { type Lang, getLang, gui } from "../i18n.js";

type _Component = Component;

// ═══════════════════════════════════════════════════════════════════════════
// Constants & Types
// ═══════════════════════════════════════════════════════════════════════════

const COLS = 10;
const ROWS = 20;
const TICK_MS = 500;

type Cell = number; // 0 = empty, 1-7 = piece color
type Board = Cell[][];
type PieceShape = number[][];

interface Piece {
	shape: PieceShape;
	x: number;
	y: number;
	type: number; // 1-7
}

interface GameState {
	board: Board;
	current: Piece | null;
	next: Piece | null;
	score: number;
	lines: number;
	level: number;
	gameOver: boolean;
	highScore: number;
}

// 7 standard Tetromino shapes
const SHAPES: PieceShape[] = [
	[[1, 1, 1, 1]], // I
	[
		[1, 1],
		[1, 1],
	], // O
	[
		[0, 1, 0],
		[1, 1, 1],
	], // T
	[
		[1, 0, 0],
		[1, 1, 1],
	], // L
	[
		[0, 0, 1],
		[1, 1, 1],
	], // J
	[
		[0, 1, 1],
		[1, 1, 0],
	], // S
	[
		[1, 1, 0],
		[0, 1, 1],
	], // Z
];

const SHAPE_COLORS = [
	(s: string) => CYAN(s), // I - cyan
	(s: string) => YELLOW(s), // O - yellow
	(s: string) => MAGENTA(s), // T - magenta
	(s: string) => `\x1b[38;5;208m${s}\x1b[0m`, // L - orange
	(s: string) => BLUE(s), // J - blue
	(s: string) => GREEN(s), // S - green
	(s: string) => RED(s), // Z - red
];

function createBoard(): Board {
	return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomPiece(): Piece {
	const type = Math.floor(Math.random() * SHAPES.length);
	return {
		shape: SHAPES[type].map((r) => [...r]),
		x: Math.floor((COLS - SHAPES[type][0].length) / 2),
		y: 0,
		type: type + 1,
	};
}

function rotate(shape: PieceShape): PieceShape {
	const rows = shape.length;
	const cols = shape[0].length;
	const rotated: PieceShape = [];
	for (let c = 0; c < cols; c++) {
		const row: number[] = [];
		for (let r = rows - 1; r >= 0; r--) {
			row.push(shape[r][c]);
		}
		rotated.push(row);
	}
	return rotated;
}

function collides(
	board: Board,
	shape: PieceShape,
	px: number,
	py: number,
): boolean {
	for (let r = 0; r < shape.length; r++) {
		for (let c = 0; c < shape[r].length; c++) {
			if (!shape[r][c]) continue;
			const bx = px + c;
			const by = py + r;
			if (bx < 0 || bx >= COLS || by >= ROWS) return true;
			if (by >= 0 && board[by][bx] !== 0) return true;
		}
	}
	return false;
}

function placePiece(board: Board, piece: Piece): void {
	for (let r = 0; r < piece.shape.length; r++) {
		for (let c = 0; c < piece.shape[r].length; c++) {
			if (!piece.shape[r][c]) continue;
			const by = piece.y + r;
			const bx = piece.x + c;
			if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
				board[by][bx] = piece.type;
			}
		}
	}
}

function clearLines(board: Board): number {
	let cleared = 0;
	for (let r = ROWS - 1; r >= 0; r--) {
		if (board[r].every((c) => c !== 0)) {
			board.splice(r, 1);
			board.unshift(Array(COLS).fill(0));
			cleared++;
			r++; // recheck same row
		}
	}
	return cleared;
}

function ghostY(board: Board, piece: Piece): number {
	let gy = piece.y;
	while (!collides(board, piece.shape, piece.x, gy + 1)) {
		gy++;
	}
	return gy;
}

function createInitialState(): GameState {
	const board = createBoard();
	const current = randomPiece();
	const next = randomPiece();
	return {
		board,
		current,
		next,
		score: 0,
		lines: 0,
		level: 1,
		gameOver: false,
		highScore: 0,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class TetrisComponent implements _Component {
	private state: GameState;
	private interval: ReturnType<typeof setInterval> | null = null;
	private onClose: () => void;
	private onSave: (s: GameState | null) => void;
	private tui: { requestRender: () => void };
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	private paused = false;
	private disposed = false;

	constructor(
		tui: { requestRender: () => void },
		onClose: () => void,
		onSave: (s: GameState | null) => void,
		saved: GameState | undefined,
		private lang: Lang,
	) {
		this.tui = tui;
		this.onClose = onClose;
		this.onSave = onSave;
		if (
			saved &&
			!saved.gameOver &&
			saved.board &&
			saved.current &&
			saved.next
		) {
			this.state = saved;
			// Ensure board has correct dimensions
			if (
				this.state.board.length !== ROWS ||
				this.state.board[0]?.length !== COLS
			) {
				this.state = createInitialState();
				this.state.highScore = saved.highScore ?? 0;
				this.startTick();
				return;
			}
			this.paused = true;
		} else {
			this.state = createInitialState();
			if (saved) this.state.highScore = saved.highScore ?? 0;
			this.startTick();
		}
	}

	private getTickMs(): number {
		return Math.max(100, TICK_MS - (this.state.level - 1) * 40);
	}

	private startTick() {
		this.stopTick();
		this.interval = setInterval(() => {
			if (this.disposed) return;
			if (!this.state.gameOver && !this.paused) {
				this.moveDown();
				this.version++;
				this.tui.requestRender();
			}
		}, this.getTickMs());
	}

	private stopTick() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	private moveDown() {
		const p = this.state.current;
		if (!p) return;
		if (!collides(this.state.board, p.shape, p.x, p.y + 1)) {
			p.y++;
		} else {
			this.lockPiece();
		}
	}

	private lockPiece() {
		const p = this.state.current;
		if (!p) return;
		placePiece(this.state.board, p);
		const cleared = clearLines(this.state.board);
		if (cleared > 0) {
			this.state.lines += cleared;
			const scoreTable = [0, 100, 300, 500, 800];
			this.state.score += (scoreTable[cleared] ?? 800) * this.state.level;
			this.state.level = Math.floor(this.state.lines / 10) + 1;
			this.startTick(); // adjust speed
		}
		if (this.state.score > this.state.highScore) {
			this.state.highScore = this.state.score;
		}
		this.state.current = this.state.next ?? randomPiece();
		this.state.next = randomPiece();
		const next = this.state.current;
		if (next && collides(this.state.board, next.shape, next.x, next.y)) {
			this.state.gameOver = true;
		}
	}

	handleInput(data: string): boolean {
		if (matchesKey(data, "escape")) {
			if (this.paused) {
				this.dispose();
				this.onSave(null);
			} else {
				this.dispose();
				this.onSave(this.state);
			}
			this.onClose();
			return true;
		}
		if (this.paused) {
			this.paused = false;
			this.startTick();
			return true;
		}
		if (this.state.gameOver) {
			if (data === "r" || data === " ") {
				const hs = this.state.highScore;
				this.state = createInitialState();
				this.state.highScore = hs;
				this.version++;
				this.startTick();
				this.tui.requestRender();
			}
			return true;
		}
		const p = this.state.current;
		if (!p) return true;

		if (matchesKey(data, "left") || data === "a") {
			if (!collides(this.state.board, p.shape, p.x - 1, p.y)) p.x--;
		} else if (matchesKey(data, "right") || data === "d") {
			if (!collides(this.state.board, p.shape, p.x + 1, p.y)) p.x++;
		} else if (matchesKey(data, "down") || data === "s") {
			this.moveDown();
		} else if (matchesKey(data, "up") || data === "w") {
			// Rotate
			const rotated = rotate(p.shape);
			if (!collides(this.state.board, rotated, p.x, p.y)) {
				p.shape = rotated;
			} else if (!collides(this.state.board, rotated, p.x - 1, p.y)) {
				p.shape = rotated;
				p.x--;
			} else if (!collides(this.state.board, rotated, p.x + 1, p.y)) {
				p.shape = rotated;
				p.x++;
			}
		} else if (data === " ") {
			// Hard drop
			while (!collides(this.state.board, p.shape, p.x, p.y + 1)) {
				p.y++;
				this.state.score += 2;
			}
			this.lockPiece();
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
		const cw = 2; // cell width
		const panelW = 14;

		const padLine = (l: string) => {
			const vl = visibleWidth(l);
			if (vl >= width) return truncateToWidth(l, width);
			return l + " ".repeat(width - vl);
		};

		// Header
		lines.push(
			padLine(
				centerPad(
					`${BOLD_CYAN("TETRIS")} ${DIM("│")} ${gui("score", this.lang)}: ${BOLD_YELLOW(String(this.state.score))} ${DIM("│")} ${gui("lines", this.lang)}: ${BOLD(String(this.state.lines))} ${DIM("│")} ${gui("level", this.lang)}: ${BOLD(String(this.state.level))}`,
					width,
				),
			),
		);

		const bw = COLS * cw;
		const boxTop = DIM(` ╭${"─".repeat(bw)}╮`);
		const boxBot = DIM(` ╰${"─".repeat(bw)}╯`);
		const boxMid = DIM(` │`);

		lines.push(padLine(boxTop));

		for (let r = 0; r < ROWS; r++) {
			let row = DIM(" │");
			for (let c = 0; c < COLS; c++) {
				const p = this.state.current;
				let cellType = this.state.board[r][c];

				// Check current piece and ghost piece
				if (p && !this.state.gameOver) {
					const gy = ghostY(this.state.board, p);
					for (let ri = 0; ri < p.shape.length; ri++) {
						for (let ci = 0; ci < p.shape[ri].length; ci++) {
							if (!p.shape[ri][ci]) continue;
							if (p.x + ci === c && p.y + ri === r) {
								cellType = p.type;
							} else if (p.x + ci === c && gy + ri === r && cellType === 0) {
								cellType = -1; // ghost marker
							}
						}
					}
				}

				if (cellType > 0) {
					row += SHAPE_COLORS[cellType - 1]("██");
				} else if (cellType === -1) {
					row += DIM("░░");
				} else {
					row += "  ";
				}
			}
			row += DIM("│");
			lines.push(padLine(row));
		}

		lines.push(padLine(boxBot));

		// Next piece preview
		const nextLines: string[] = [];
		if (this.state.next) {
			const n = this.state.next;
			nextLines.push(`Next: `);
			for (let r = 0; r < n.shape.length; r++) {
				let nl = "  ";
				for (let c = 0; c < n.shape[r].length; c++) {
					if (n.shape[r][c]) nl += SHAPE_COLORS[n.type - 1]("██");
					else nl += "  ";
				}
				nextLines.push(nl);
			}
		}

		// Footer
		let footer: string;
		if (this.paused) {
			footer = `${BOLD_YELLOW(gui("paused", this.lang))} ${gui("anyKeyContinue", this.lang)}, ${BOLD(gui("quit", this.lang))}`;
		} else if (this.state.gameOver) {
			footer = `${BOLD_RED(gui("gameOver", this.lang))} ${BOLD(gui("restart", this.lang))}, ${BOLD(gui("quit", this.lang))}`;
		} else {
			footer = `←→ ${gui("moveAction", this.lang)}  ↑ ${gui("rotate", this.lang)}  ↓ ${gui("softDrop", this.lang)}  ${BOLD("SPACE")} ${gui("hardDrop", this.lang)}  ${BOLD("ESC")} ${gui("paused", this.lang)}`;
		}
		lines.push(padLine(centerPad(footer, width)));

		if (this.state.next) {
			const n = this.state.next;
			lines.push(padLine(centerPad(`${DIM(gui("next", this.lang))}`, width)));
			for (let r = 0; r < n.shape.length; r++) {
				let nl = "";
				for (let c = 0; c < n.shape[r].length; c++) {
					if (n.shape[r][c]) nl += SHAPE_COLORS[n.type - 1]("██");
					else nl += "  ";
				}
				lines.push(padLine(centerPad(nl, width)));
			}
		}

		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}

	dispose() {
		this.disposed = true;
		this.stopTick();
	}

	destroy() {
		this.dispose();
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// GameModule export
// ═══════════════════════════════════════════════════════════════════════════

const INTRO = {
	en: `Tetris - Block Stacking

Use ←→/AD to move, ↑/W to rotate, ↓/S for soft drop.
Complete full lines to clear them. Don't let blocks reach the top!`,
	zh: `俄罗斯方块 - 堆叠消行

用 ←→/AD 移动，↑/W 旋转，↓/S 加速下落。
填满整行即可消除。别让方块堆到顶部！`,
};

const SAVE_TYPE = "tetris-save";

const gameTetris: GameModule = {
	meta: {
		id: "tetris",
		name: "Tetris",
		description: "Stack & clear lines / 堆叠消行",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Tetris requires interactive mode", "error");
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
				return new TetrisComponent(
					tui,
					() => done(undefined),
					(s) => pi.appendEntry(SAVE_TYPE, s),
					saved,
					lang,
				);
			});
		};

		registerMenuEntry(gameTetris.meta, handler, SAVE_TYPE);
	},
};

export default gameTetris;
