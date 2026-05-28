/**
 * Snake - Eat food, grow, don't crash.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
	type Component,
	matchesKey,
	visibleWidth,
	truncateToWidth,
} from "@earendil-works/pi-tui";
import type { GameModule } from "../types.js";
import {
	BOLD,
	DIM,
	RED,
	GREEN,
	BOLD_GREEN,
	BOLD_RED,
	BOLD_YELLOW,
} from "../ansi.js";
import { type Lang, getLang, gui } from "../i18n.js";

type _Component = Component;

// ═══════════════════════════════════════════════════════════════════════════
// Game constants & types
// ═══════════════════════════════════════════════════════════════════════════

const GAME_WIDTH = 40;
const GAME_HEIGHT = 15;
const TICK_MS = 100;

type Direction = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };

interface GameState {
	snake: Point[];
	food: Point;
	direction: Direction;
	nextDirection: Direction;
	score: number;
	gameOver: boolean;
	highScore: number;
}

function createInitialState(ew: number): GameState {
	const sx = Math.floor(ew / 2),
		sy = Math.floor(GAME_HEIGHT / 2);
	const snake = [
		{ x: sx, y: sy },
		{ x: sx - 1, y: sy },
		{ x: sx - 2, y: sy },
	];
	return {
		snake,
		food: spawnFood(snake, ew),
		direction: "right",
		nextDirection: "right",
		score: 0,
		gameOver: false,
		highScore: 0,
	};
}

function spawnFood(snake: Point[], width: number): Point {
	let food: Point;
	do {
		food = {
			x: Math.floor(Math.random() * width),
			y: Math.floor(Math.random() * GAME_HEIGHT),
		};
	} while (snake.some((s) => s.x === food.x && s.y === food.y));
	return food;
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class SnakeComponent implements _Component {
	private state: GameState | null = null;
	private interval: ReturnType<typeof setInterval> | null = null;
	private onClose: () => void;
	private onSave: (s: GameState | null) => void;
	private tui: { requestRender: () => void };
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	private paused: boolean;
	private effectiveWidth = 0;
	private started = false;
	private savedHighScore = 0;

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
			this.effectiveWidth = GAME_WIDTH; // will be corrected on first render
		} else {
			if (saved) this.savedHighScore = saved.highScore;
			this.paused = false;
			// State is created on first render when effectiveWidth is known
		}
	}

	private startGame() {
		this.interval = setInterval(() => {
			if (this.state && !this.state.gameOver) {
				this.tick();
				this.version++;
				this.tui.requestRender();
			}
		}, TICK_MS);
	}

	private tick() {
		if (!this.state) return;
		this.state.direction = this.state.nextDirection;
		const head = this.state.snake[0];
		const d = this.state.direction;
		const nh = {
			x: head.x + (d === "right" ? 1 : d === "left" ? -1 : 0),
			y: head.y + (d === "down" ? 1 : d === "up" ? -1 : 0),
		};
		if (
			nh.x < 0 ||
			nh.x >= this.effectiveWidth ||
			nh.y < 0 ||
			nh.y >= GAME_HEIGHT ||
			this.state.snake.some((s) => s.x === nh.x && s.y === nh.y)
		) {
			this.state.gameOver = true;
			return;
		}
		this.state.snake.unshift(nh);
		if (nh.x === this.state.food.x && nh.y === this.state.food.y) {
			this.state.score += 10;
			if (this.state.score > this.state.highScore)
				this.state.highScore = this.state.score;
			this.state.food = spawnFood(this.state.snake, this.effectiveWidth);
		} else this.state.snake.pop();
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
			this.startGame();
			return true;
		}
		if (!this.state) return true;
		if (matchesKey(data, "up") || data === "w") {
			if (this.state.direction !== "down") this.state.nextDirection = "up";
		} else if (matchesKey(data, "down") || data === "s") {
			if (this.state.direction !== "up") this.state.nextDirection = "down";
		} else if (matchesKey(data, "right") || data === "d") {
			if (this.state.direction !== "left") this.state.nextDirection = "right";
		} else if (matchesKey(data, "left") || data === "a") {
			if (this.state.direction !== "right") this.state.nextDirection = "left";
		}
		if (this.state.gameOver && (data === "r" || data === " ")) {
			const hs = this.state.highScore;
			this.state = createInitialState(this.effectiveWidth);
			this.state.highScore = hs;
			this.onSave(null);
			this.version++;
			this.tui.requestRender();
		}
		return true;
	}

	invalidate() {
		this.cachedWidth = 0;
	}

	render(width: number): string[] {
		const cw = 2;
		const ew = Math.max(10, Math.min(GAME_WIDTH, Math.floor((width - 4) / cw)));

		// Create initial state on first render when effectiveWidth is known
		if (!this.state) {
			this.effectiveWidth = ew;
			this.state = createInitialState(ew);
			this.state.highScore = this.savedHighScore;
		}

		// Update effective width and adjust game state if needed
		if (ew !== this.effectiveWidth) {
			this.effectiveWidth = ew;
			// Check if snake head is now out of bounds due to width shrink
			const head = this.state.snake[0];
			if (head.x >= ew) {
				this.state.gameOver = true;
			}
			if (this.state.food.x >= ew || this.state.food.y >= GAME_HEIGHT) {
				this.state.food = spawnFood(this.state.snake, ew);
			}
			this.version++;
		}

		// Start game on first render when effectiveWidth is known
		if (!this.started && !this.paused && !this.state.gameOver) {
			this.started = true;
			this.startGame();
		}

		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const lines: string[] = [];
		const bw = ew * cw;
		const boxLine = (c: string) => {
			const cl = visibleWidth(c);
			return DIM(" │") + c + " ".repeat(Math.max(0, bw - cl)) + DIM("│");
		};
		const padLine = (l: string) => {
			const vl = visibleWidth(l);
			if (vl >= width) return truncateToWidth(l, width);
			return l + " ".repeat(width - vl);
		};

		lines.push(padLine(DIM(` ╭${"─".repeat(bw)}╮`)));
		lines.push(
			padLine(
				boxLine(
					`${BOLD_GREEN("SNAKE")} │ ${gui("score", this.lang)}: ${BOLD_YELLOW(String(this.state.score))} │ ${gui("best", this.lang)}: ${BOLD_YELLOW(String(this.state.highScore))}`,
				),
			),
		);
		lines.push(padLine(DIM(` ├${"─".repeat(bw)}┤`)));
		for (let y = 0; y < GAME_HEIGHT; y++) {
			let row = "";
			for (let x = 0; x < this.effectiveWidth; x++) {
				const isHead =
					this.state.snake[0].x === x && this.state.snake[0].y === y;
				const isBody = this.state.snake
					.slice(1)
					.some((s) => s.x === x && s.y === y);
				const isFood = this.state.food.x === x && this.state.food.y === y;
				if (isHead) row += GREEN("██");
				else if (isBody) row += GREEN("▓▓");
				else if (isFood) row += RED("◆ ");
				else row += "  ";
			}
			lines.push(padLine(DIM(" │") + row + DIM("│")));
		}
		lines.push(padLine(DIM(` ├${"─".repeat(bw)}┤`)));
		let footer: string;
		if (this.paused)
			footer = `${BOLD_YELLOW(gui("paused", this.lang))} ${gui("anyKeyContinue", this.lang)}, ${BOLD(gui("quit", this.lang))}`;
		else if (this.state.gameOver)
			footer = `${BOLD_RED(gui("gameOver", this.lang))} ${BOLD("R")} ${gui("restartAction", this.lang)}, ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
		else
			footer = `${gui("move", this.lang)}/WASD ${gui("moveAction", this.lang)}, ${BOLD("ESC")} ${gui("paused", this.lang)}, ${BOLD(gui("quit", this.lang))}`;
		lines.push(padLine(boxLine(footer)));
		lines.push(padLine(DIM(` ╰${"─".repeat(bw)}╯`)));
		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}

	dispose() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// GameModule export
// ═══════════════════════════════════════════════════════════════════════════

const INTRO = {
	en: `Snake - Eat & Grow

Use arrow keys or WASD to steer the snake. Eat food to grow longer.
Don't crash into walls or your own tail!`,
	zh: `贪吃蛇 - 吃食成长

用方向键或 WASD 控制蛇的移动方向。吃到食物蛇身变长。
别撞到墙壁或自己的身体！`,
};

const SAVE_TYPE = "snake-save";

const gameSnake: GameModule = {
	meta: {
		id: "snake",
		name: "Snake",
		description: "Eat & grow / 吃食成长",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Snake requires interactive mode", "error");
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
				return new SnakeComponent(
					tui,
					() => done(undefined),
					(s) => pi.appendEntry(SAVE_TYPE, s),
					saved,
					lang,
				);
			});
		};

		registerMenuEntry(gameSnake.meta, handler, SAVE_TYPE);
	},
};

export default gameSnake;
