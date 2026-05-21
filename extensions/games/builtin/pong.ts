/**
 * Pong - Classic paddle ball game vs AI.
 *
 * Control your paddle with ↑↓ keys. First to 5 wins.
 * Uses interval-based animation for smooth gameplay.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey } from "@earendil-works/pi-tui";
import type { GameModule } from "../types.js";
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

// ═══════════════════════════════════════════════════════════════════════════
// Game Logic
// ═══════════════════════════════════════════════════════════════════════════

const WIN_SCORE = 5;

const INTRO = {
	en: `Pong - Classic Paddle Game

Control your paddle with ↑↓ keys. First player to reach ${WIN_SCORE} points wins.
The ball bounces off top and bottom walls.
Hit it past the AI paddle to score!`,
	zh: `乒乓 - 经典弹球游戏

用 ↑↓ 方向键控制你的挡板。先得 ${WIN_SCORE} 分者获胜。
球会在上下墙壁反弹，将球打过对手挡板即可得分！`,
};

interface GameState {
	ballX: number;
	ballY: number;
	ballDX: number;
	ballDY: number;
	playerY: number; // center of paddle
	aiY: number;
	playerScore: number;
	aiScore: number;
	paddleH: number;
	status: "countdown" | "playing" | "scored" | "won" | "lost";
	countdown: number;
	keysDown: Set<string>;
}

function createInitialState(): GameState {
	return {
		ballX: 0.5,
		ballY: 0.5,
		ballDX: 0.025,
		ballDY: 0,
		playerY: 0.5,
		aiY: 0.5,
		playerScore: 0,
		aiScore: 0,
		paddleH: 0.15,
		status: "countdown",
		countdown: 3,
		keysDown: new Set(),
	};
}

function resetBall(state: GameState, towardPlayer: boolean = true): void {
	state.ballX = 0.5;
	state.ballY = 0.5;
	state.ballDX = towardPlayer ? 0.025 : -0.025;
	state.ballDY = 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class PongComponent implements _Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	private gameInterval: ReturnType<typeof setInterval> | null = null;
	private countdownInterval: ReturnType<typeof setInterval> | null = null;

	constructor(
		private tui: { requestRender: () => void },
		private state: GameState,
		private onClose: () => void,
		private lang: "en" | "zh" = "en",
	) {
		this.startCountdown();
	}

	destroy() {
		if (this.gameInterval) clearInterval(this.gameInterval);
		if (this.countdownInterval) clearInterval(this.countdownInterval);
	}

	private startCountdown() {
		this.state.countdown = 3;
		this.state.status = "countdown";
		this.countdownInterval = setInterval(() => {
			this.state.countdown--;
			if (this.state.countdown <= 0) {
				if (this.countdownInterval) clearInterval(this.countdownInterval);
				this.state.status = "playing";
				this.startGame();
			}
			this.version++;
			this.tui.requestRender();
		}, 800);
	}

	private startGame() {
		this.gameInterval = setInterval(() => this.tick(), 50);
	}

	private tick() {
		const s = this.state;
		if (s.status !== "playing") return;

		// Player movement — keysDown stays set until opposite key or quit clears it
		const speed = 0.025;
		if (s.keysDown.has("up")) {
			s.playerY = Math.max(s.paddleH / 2, s.playerY - speed);
		}
		if (s.keysDown.has("down")) {
			s.playerY = Math.min(1 - s.paddleH / 2, s.playerY + speed);
		}

		// AI movement - tracks ball with some delay
		const aiSpeed = 0.015;
		const aiTarget = s.ballY;
		if (s.aiY < aiTarget - 0.02)
			s.aiY = Math.min(1 - s.paddleH / 2, s.aiY + aiSpeed);
		else if (s.aiY > aiTarget + 0.02)
			s.aiY = Math.max(s.paddleH / 2, s.aiY - aiSpeed);

		// Ball movement
		s.ballX += s.ballDX;
		s.ballY += s.ballDY;

		// Top/bottom bounce — clamp so ball stays within renderable rows
		if (s.ballY <= 0) {
			s.ballDY = Math.abs(s.ballDY);
			s.ballY = 0.001;
		} else if (s.ballY >= 1) {
			s.ballDY = -Math.abs(s.ballDY);
			s.ballY = 0.999;
		}

		// Player paddle collision (left side, x ≈ 0.05)
		if (
			s.ballX <= 0.06 &&
			s.ballX >= 0.02 &&
			s.ballY >= s.playerY - s.paddleH / 2 &&
			s.ballY <= s.playerY + s.paddleH / 2
		) {
			s.ballDX = Math.abs(s.ballDX) * 1.05;
			s.ballDY += (s.ballY - s.playerY) * 0.1;
			s.ballX = 0.06;
		}

		// AI paddle collision (right side, x ≈ 0.95)
		if (
			s.ballX >= 0.94 &&
			s.ballX <= 0.98 &&
			s.ballY >= s.aiY - s.paddleH / 2 &&
			s.ballY <= s.aiY + s.paddleH / 2
		) {
			s.ballDX = -Math.abs(s.ballDX) * 1.05;
			s.ballDY += (s.ballY - s.aiY) * 0.1;
			s.ballX = 0.94;
		}

		// Speed cap
		const maxSpeed = 0.06;
		s.ballDX = Math.max(-maxSpeed, Math.min(maxSpeed, s.ballDX));
		s.ballDY = Math.max(-maxSpeed, Math.min(maxSpeed, s.ballDY));

		// Scoring
		if (s.ballX < 0) {
			s.aiScore++;
			if (s.aiScore >= WIN_SCORE) {
				s.status = "lost";
			} else {
				s.status = "scored";
				setTimeout(() => {
					resetBall(s, true); // AI scored, serve toward player
					s.status = "playing";
					this.version++;
					this.tui.requestRender();
				}, 800);
			}
		} else if (s.ballX > 1) {
			s.playerScore++;
			if (s.playerScore >= WIN_SCORE) {
				s.status = "won";
			} else {
				s.status = "scored";
				setTimeout(() => {
					resetBall(s, false); // Player scored, serve toward AI
					s.status = "playing";
					this.version++;
					this.tui.requestRender();
				}, 800);
			}
		}

		this.version++;
		this.tui.requestRender();
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

		if (s.status === "won" || s.status === "lost") {
			if (data === "r") {
				this.destroy();
				Object.assign(s, createInitialState());
				this.startCountdown();
				this.updateState();
			}
			return true;
		}

		if (matchesKey(data, "up")) {
			s.keysDown.add("up");
			s.keysDown.delete("down"); // clear opposite
		}
		if (matchesKey(data, "down")) {
			s.keysDown.add("down");
			s.keysDown.delete("up"); // clear opposite
		}
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const s = this.state;
		const lines: string[] = [];
		const W = Math.min(width, 60);
		const H = 18;

		// Title / Score
		lines.push(
			centerPad(
				`${BOLD_CYAN(String(s.playerScore))} ${DIM("─".repeat(8))} ${BOLD("PONG")} ${DIM("─".repeat(8))} ${BOLD_YELLOW(String(s.aiScore))}`,
				width,
			),
		);
		lines.push(
			centerPad(
				`${BOLD_CYAN(gui("you", this.lang))} ${DIM("vs")} ${BOLD_YELLOW("AI")}`,
				width,
			),
		);
		lines.push("");

		// Game field
		const topBorder = centerPad("╔" + "═".repeat(W - 2) + "╗", width);
		lines.push(topBorder);

		for (let y = 0; y < H; y++) {
			const normalizedY = y / H;
			let row = "║";

			for (let x = 0; x < W - 2; x++) {
				// Player paddle
				const pY = s.playerY;
				const pTop = pY - s.paddleH / 2;
				const pBot = pY + s.paddleH / 2;
				if (x === 1 && normalizedY >= pTop && normalizedY < pBot) {
					row += BOLD_CYAN("█");
					continue;
				}
				// AI paddle
				const aY = s.aiY;
				const aTop = aY - s.paddleH / 2;
				const aBot = aY + s.paddleH / 2;
				if (x === W - 3 && normalizedY >= aTop && normalizedY < aBot) {
					row += BOLD_YELLOW("█");
					continue;
				}
				// Center line
				if (x === Math.floor((W - 2) / 2) && y % 2 === 0) {
					row += DIM("│");
					continue;
				}
				// Ball - only show when playing or countdown
				if (s.status === "playing" || s.status === "countdown") {
					const bx = Math.round(s.ballX * (W - 2));
					const by = Math.round(s.ballY * H);
					if (x === bx && y === by) {
						row += BOLD_GREEN("●");
						continue;
					}
				}
				row += " ";
			}
			row += "║";
			lines.push(centerPad(row, width));
		}
		const botBorder = centerPad("╚" + "═".repeat(W - 2) + "╝", width);
		lines.push(botBorder);

		// Status
		lines.push("");
		if (s.status === "countdown") {
			lines.push(centerPad(BOLD_YELLOW(`Get ready... ${s.countdown}`), width));
		} else if (s.status === "won") {
			lines.push(centerPad(BOLD_GREEN(gui("youWinSimple", this.lang)), width));
		} else if (s.status === "lost") {
			lines.push(centerPad(BOLD_RED(gui("aiWins", this.lang)), width));
		}

		// Footer
		let footer: string;
		if (s.status === "won" || s.status === "lost")
			footer = `${BOLD("R")} ${gui("restartAction", this.lang)}  ${DIM("|")}  ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
		else
			footer = `${BOLD("↑↓")} ${gui("movePaddle", this.lang)}  ${DIM("|")}  ${`${gui("firstTo", this.lang)} ${WIN_SCORE} ${gui("points", this.lang)}`}  ${DIM("|")}  ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
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

const SAVE_TYPE = "pong-save";

const gamePong: GameModule = {
	meta: {
		id: "pong",
		name: "Pong",
		description: "Classic paddle game",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Pong requires interactive mode", "error");
				return;
			}

			const lang = getLang(ctx);
			const state = createInitialState();

			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				const comp = new PongComponent(
					tui,
					state,
					() => {
						comp.destroy();
						pi.appendEntry(SAVE_TYPE, state);
						done(undefined);
					},
					lang,
				);
				return comp;
			});
		};

		registerMenuEntry(gamePong.meta, handler, SAVE_TYPE);
	},
};

export default gamePong;
