/**
 * Breakout - Bounce ball, break bricks.
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

const COLS = 40;
const ROWS = 18;
const PADDLE_W = 7;
const BRICK_ROWS = 5;
const BRICK_COLS = 20; // must divide COLS evenly
const TICK_MS = 60;

interface GameState {
	paddle: number; // x position (center)
	ball: { x: number; y: number; dx: number; dy: number };
	bricks: number[][]; // 0=empty, 1-5=colors
	score: number;
	lives: number;
	gameOver: boolean;
	won: boolean;
	level: number;
}

const BRICK_COLORS = [
	(s: string) => RED(s),
	(s: string) => `\x1b[38;5;208m${s}\x1b[0m`, // orange
	(s: string) => YELLOW(s),
	(s: string) => GREEN(s),
	(s: string) => CYAN(s),
];

function createInitialState(level = 1): GameState {
	const bricks: number[][] = [];
	for (let r = 0; r < BRICK_ROWS; r++) {
		const row: number[] = [];
		for (let c = 0; c < BRICK_COLS; c++) {
			row.push(r + 1);
		}
		bricks.push(row);
	}
	return {
		paddle: Math.floor(COLS / 2),
		ball: {
			x: Math.floor(COLS / 2),
			y: ROWS - 3,
			dx: (Math.random() > 0.5 ? 1 : -1) * (0.8 + level * 0.1),
			dy: -(1 + level * 0.1),
		},
		bricks,
		score: 0,
		lives: 3,
		gameOver: false,
		won: false,
		level,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class BreakoutComponent implements _Component {
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
	private started = false;
	private effCols = COLS;

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
		if (saved && !saved.gameOver) {
			this.state = saved;
			this.paused = true;
			this.started = true;
		} else {
			this.state = createInitialState();
			if (saved) this.state.score = saved.score;
		}
	}

	private startTick() {
		this.stopTick();
		this.interval = setInterval(() => {
			if (!this.state.gameOver && !this.paused) {
				this.tick();
				this.version++;
				this.tui.requestRender();
			}
		}, TICK_MS);
	}

	private stopTick() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	private tick() {
		const b = this.state.ball;

		// Move ball
		b.x += b.dx;
		b.y += b.dy;

		// Wall bounce
		if (b.x <= 0) {
			b.x = 0;
			b.dx = Math.abs(b.dx);
		}
		if (b.x >= this.effCols - 1) {
			b.x = this.effCols - 1;
			b.dx = -Math.abs(b.dx);
		}
		if (b.y <= 0) {
			b.y = 0;
			b.dy = Math.abs(b.dy);
		}

		// Paddle bounce
		const pw = PADDLE_W;
		const px = this.state.paddle - Math.floor(pw / 2);
		const py = ROWS - 2;
		if (
			b.dy > 0 &&
			Math.round(b.y) >= py &&
			Math.round(b.y) <= py + 1 &&
			b.x >= px &&
			b.x <= px + pw - 1
		) {
			b.dy = -Math.abs(b.dy);
			b.y = py - 1;
			// Angle based on where ball hits paddle
			const hitPos = (b.x - px) / pw; // 0..1
			b.dx = (hitPos - 0.5) * 2.5;
		}

		// Brick collision
		const brickW = this.effCols / BRICK_COLS;
		const bx = Math.floor(b.x / brickW);
		const by = Math.round(b.y);
		if (by >= 0 && by < BRICK_ROWS && bx >= 0 && bx < BRICK_COLS) {
			if (this.state.bricks[by][bx] !== 0) {
				this.state.bricks[by][bx] = 0;
				this.state.score += 10 * this.state.level;
				b.dy = Math.abs(b.dy);
				// Check win
				if (this.state.bricks.every((row) => row.every((c) => c === 0))) {
					this.state.won = true;
					this.state.gameOver = true;
				}
			}
		}

		// Ball lost
		if (b.y >= ROWS) {
			this.state.lives--;
			if (this.state.lives <= 0) {
				this.state.gameOver = true;
			} else {
				// Reset ball
				b.x = this.state.paddle;
				b.y = ROWS - 3;
				b.dx = (Math.random() > 0.5 ? 1 : -1) * 0.8;
				b.dy = -(1 + this.state.level * 0.1);
			}
		}
	}

	handleInput(data: string): boolean {
		if (matchesKey(data, "escape")) {
			this.dispose();
			this.onSave(this.paused ? null : this.state);
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
				const sc = this.state.score;
				const lv = this.state.won ? this.state.level + 1 : 1;
				this.state = createInitialState(lv);
				this.state.score = sc;
				this.version++;
				this.startTick();
				this.tui.requestRender();
			}
			return true;
		}

		if (matchesKey(data, "left") || data === "a") {
			this.state.paddle = Math.max(
				Math.floor(PADDLE_W / 2),
				this.state.paddle - 6,
			);
		} else if (matchesKey(data, "right") || data === "d") {
			this.state.paddle = Math.min(
				this.effCols - Math.ceil(PADDLE_W / 2) - 1,
				this.state.paddle + 6,
			);
		}

		this.version++;
		this.tui.requestRender();
		return true;
	}

	invalidate() {
		this.cachedWidth = 0;
	}

	render(width: number): string[] {
		// Calculate effective columns
		this.effCols = Math.min(COLS, width - 4);
		// Make divisible by BRICK_COLS
		this.effCols = Math.max(
			BRICK_COLS,
			Math.floor(this.effCols / BRICK_COLS) * BRICK_COLS,
		);

		if (!this.started && !this.paused && !this.state.gameOver) {
			this.started = true;
			this.startTick();
		}
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;

		const lines: string[] = [];
		const bw = this.effCols;
		const padLine = (l: string) => {
			const vl = visibleWidth(l);
			if (vl >= width) return truncateToWidth(l, width);
			return l + " ".repeat(width - vl);
		};

		// Header
		lines.push(
			padLine(
				centerPad(
					`${BOLD_CYAN("BREAKOUT")} ${DIM("│")} ${gui("score", this.lang)}: ${BOLD_YELLOW(String(this.state.score))} ${DIM("│")} ${gui("lives", this.lang)}: ${BOLD_RED("♥".repeat(this.state.lives))} ${DIM("│")} ${gui("level", this.lang)}: ${BOLD(String(this.state.level))}`,
					width,
				),
			),
		);

		const boxLine = (c: string) => {
			const cl = visibleWidth(c);
			return DIM(" │") + c + " ".repeat(Math.max(0, bw - cl)) + DIM("│");
		};

		lines.push(padLine(DIM(` ╭${"─".repeat(bw)}╮`)));

		// Render bricks + empty space + ball + paddle
		for (let y = 0; y < ROWS; y++) {
			let row = "";
			for (let x = 0; x < this.effCols; x++) {
				// Brick?
				const brickW = this.effCols / BRICK_COLS;
				const bi = Math.floor(x / brickW);
				let drawn = false;

				if (y < BRICK_ROWS && bi < BRICK_COLS) {
					const bv = this.state.bricks[y][bi];
					if (bv > 0) {
						row += BRICK_COLORS[bv - 1]("▓");
						drawn = true;
					}
				}

				// Ball
				if (!drawn) {
					const b = this.state.ball;
					if (Math.round(b.x) === x && Math.round(b.y) === y) {
						row += BOLD_YELLOW("●");
						drawn = true;
					}
				}

				// Paddle
				if (!drawn && y === ROWS - 2) {
					const px = this.state.paddle - Math.floor(PADDLE_W / 2);
					if (x >= px && x < px + PADDLE_W) {
						row += BOLD_GREEN("█");
						drawn = true;
					}
				}

				if (!drawn) row += " ";
			}
			lines.push(padLine(DIM(" │") + row + DIM("│")));
		}

		lines.push(padLine(DIM(` ╰${"─".repeat(bw)}╯`)));

		// Footer
		let footer: string;
		if (this.paused)
			footer = `${BOLD_YELLOW(gui("paused", this.lang))} ${gui("anyKeyContinue", this.lang)}, ${BOLD(gui("quit", this.lang))}`;
		else if (this.state.gameOver && this.state.won)
			footer = `${BOLD_GREEN(gui("levelClear", this.lang))} ${BOLD(gui("restart", this.lang))}, ${BOLD(gui("quit", this.lang))}`;
		else if (this.state.gameOver)
			footer = `${BOLD_RED(gui("gameOver", this.lang))} ${BOLD(gui("restart", this.lang))}, ${BOLD(gui("quit", this.lang))}`;
		else
			footer = `←→/AD ${gui("movePaddle", this.lang)}  ${BOLD("ESC")} ${gui("paused", this.lang)}  ${BOLD(gui("quit", this.lang))}`;
		lines.push(padLine(boxLine(footer)));

		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}

	dispose() {
		this.stopTick();
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// GameModule export
// ═══════════════════════════════════════════════════════════════════════════

const INTRO = {
	en: `Breakout - Brick Breaker

Move the paddle with ←→ keys to bounce the ball and destroy all bricks.
Don't let the ball fall past your paddle!`,
	zh: `打砖块 - 经典弹球消砖

用 ←→ 方向键移动挡板，反弹小球消除所有砖块。
别让球从挡板下方掉落！`,
};

const SAVE_TYPE = "breakout-save";

const gameBreakout: GameModule = {
	meta: {
		id: "breakout",
		name: "Breakout",
		description: "Break bricks with ball / 弹球消砖",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Breakout requires interactive mode", "error");
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
				return new BreakoutComponent(
					tui,
					() => done(undefined),
					(s) => pi.appendEntry(SAVE_TYPE, s),
					saved,
					lang,
				);
			});
		};

		registerMenuEntry(gameBreakout.meta, handler, SAVE_TYPE);
	},
};

export default gameBreakout;
