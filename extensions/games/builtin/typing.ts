/**
 * Typing Test - Speed typing challenge.
 *
 * Type the displayed text as fast and accurately as you can.
 * Shows WPM, accuracy, and highlights errors in real-time.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	type Component,
	matchesKey,
	visibleWidth,
} from "@earendil-works/pi-tui";
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

const SENTENCES = [
	"The quick brown fox jumps over the lazy dog near the river bank.",
	"Programming is the art of telling another human what one wants the computer to do.",
	"Every great developer you know got there by solving problems they were unqualified to solve.",
	"Code is like humor. When you have to explain it, it is bad.",
	"First solve the problem, then write the code to implement the solution.",
	"The best error message is the one that never shows up in production.",
	"Simplicity is the soul of efficiency in software engineering and design.",
	"Any fool can write code that a computer can understand.",
	"Good programmers write code that humans can understand and maintain.",
	"Experience is the name everyone gives to their mistakes in the past.",
	"Talking is easy, but writing clean code takes practice and dedication.",
	"The most important property of a program is whether it accomplishes the intention of its user.",
	"Measuring programming progress by lines of code is like measuring aircraft progress by weight.",
	"Debugging is twice as hard as writing the code in the first place.",
	"The only way to learn a new programming language is by writing programs in it.",
	"In theory there is no difference between theory and practice, but in practice there is.",
	"Sometimes it pays to stay in bed on Monday rather than spending the rest of the week debugging code.",
	"A language that does not affect the way you think about programming is not worth knowing.",
	"The computer was born to solve problems that did not exist before it was created.",
];

type Phase = "ready" | "playing" | "done";

interface GameState {
	targetText: string;
	typed: string;
	errors: Set<number>; // positions with errors
	cursorPos: number;
	phase: Phase;
	startTime: number;
	elapsed: number;
	wpm: number;
	accuracy: number;
	bestWpm: number;
}

function pickText(): string {
	return SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
}

function createInitialState(bestWpm: number = 0): GameState {
	return {
		targetText: pickText(),
		typed: "",
		errors: new Set(),
		cursorPos: 0,
		phase: "ready",
		startTime: 0,
		elapsed: 0,
		wpm: 0,
		accuracy: 100,
		bestWpm,
	};
}

function calculateStats(state: GameState): void {
	if (state.typed.length === 0) {
		state.wpm = 0;
		state.accuracy = 100;
		return;
	}

	const elapsedMinutes = state.elapsed / 60000;
	if (elapsedMinutes <= 0) {
		state.wpm = 0;
		state.accuracy = 100;
		return;
	}

	// Count correct characters
	let correct = 0;
	for (let i = 0; i < state.typed.length; i++) {
		if (state.typed[i] === state.targetText[i]) correct++;
	}

	// WPM: (correct chars / 5) / minutes
	state.wpm = Math.round(correct / 5 / elapsedMinutes);
	state.accuracy = Math.round((correct / state.typed.length) * 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class TypingTestComponent implements _Component {
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
			if (state.phase === "playing") {
				state.elapsed = Date.now() - state.startTime;
				calculateStats(state);
				this.version++;
				tui.requestRender();
			}
		}, 200);
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

		if (s.phase === "done") {
			if (data === "r") {
				const best = Math.max(s.bestWpm, s.wpm);
				Object.assign(s, createInitialState(best));
				this.updateState();
			}
			return true;
		}

		if (s.phase === "ready") {
			// Any printable character starts the test
			if (data.length === 1 && data >= " " && data <= "~") {
				s.phase = "playing";
				s.startTime = Date.now();
				// Process this first character
				this.processChar(data);
			}
			return true;
		}

		// Playing
		if (matchesKey(data, "backspace")) {
			if (s.cursorPos > 0) {
				s.cursorPos--;
				s.typed = s.typed.slice(0, -1);
				s.errors.delete(s.cursorPos);
				this.updateState();
			}
			return true;
		}

		if (data.length === 1 && data >= " " && data <= "~") {
			this.processChar(data);
		}
		return true;
	}

	private processChar(ch: string) {
		const s = this.state;
		s.typed += ch;
		if (ch !== s.targetText[s.cursorPos]) {
			s.errors.add(s.cursorPos);
		}
		s.cursorPos++;

		// Check if done
		if (s.cursorPos >= s.targetText.length) {
			s.elapsed = Date.now() - s.startTime;
			calculateStats(s);
			s.phase = "done";
			if (s.wpm > s.bestWpm) s.bestWpm = s.wpm;
		}

		this.updateState();
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const s = this.state;
		const lines: string[] = [];

		const titleText = " Typing Test ";
		const tLen = titleText.length;
		const bLen = Math.max(0, width - tLen);
		lines.push(
			DIM("─".repeat(Math.floor(bLen / 2))) +
				BOLD_CYAN(titleText) +
				DIM("─".repeat(bLen - Math.floor(bLen / 2))),
		);
		lines.push("");

		// Stats bar
		const secs = Math.floor(s.elapsed / 1000);
		const timeStr = `${secs}s`;
		const accLabel = gui("accuracy", this.lang);
		const bestLabel = gui("best", this.lang);
		lines.push(
			centerPad(
				`${BOLD_CYAN(`${s.wpm} ${gui("wpm", this.lang)}`)}  ${DIM("|")}  ${s.accuracy >= 95 ? BOLD_GREEN(`${s.accuracy}%`) : s.accuracy >= 80 ? BOLD_YELLOW(`${s.accuracy}%`) : BOLD_RED(`${s.accuracy}%`)} ${accLabel}  ${DIM("|")}  ${timeStr}  ${DIM("|")}  ${bestLabel}: ${BOLD_CYAN(`${s.bestWpm} ${gui("wpm", this.lang)}`)}`,
				width,
			),
		);
		lines.push("");

		// Target text with highlighting
		const maxLineLen = width - 4;
		const text = s.targetText;
		const typed = s.typed;

		// Word-wrap the text display
		let lineStart = 0;
		while (lineStart < text.length) {
			let lineEnd = Math.min(lineStart + maxLineLen, text.length);
			// Try to break at a space
			if (lineEnd < text.length) {
				const lastSpace = text.lastIndexOf(" ", lineEnd);
				if (lastSpace > lineStart) lineEnd = lastSpace + 1;
			}

			let textLine = "  ";
			for (let i = lineStart; i < lineEnd; i++) {
				const targetChar = text[i];
				if (i < typed.length) {
					// Already typed
					if (s.errors.has(i)) {
						textLine += BOLD_RED(targetChar === " " ? "·" : targetChar);
					} else {
						textLine += DIM(targetChar);
					}
				} else if (i === s.cursorPos) {
					// Current cursor position
					textLine += "\x1b[7m" + BOLD_GREEN(targetChar) + "\x1b[0m";
				} else {
					// Not yet typed
					textLine += targetChar;
				}
			}
			lines.push(textLine);
			lineStart = lineEnd;
		}

		// Progress bar
		if (s.phase !== "ready") {
			const progress = s.cursorPos / s.targetText.length;
			const barW = Math.min(40, width - 4);
			const filled = Math.round(progress * barW);
			const empty = barW - filled;
			const bar = BOLD_GREEN("█".repeat(filled)) + DIM("░".repeat(empty));
			lines.push("");
			lines.push(centerPad(`${bar} ${Math.round(progress * 100)}%`, width));
		}

		// Phase-specific messages
		lines.push("");
		if (s.phase === "ready") {
			lines.push(centerPad(BOLD_YELLOW(gui("startTyping", this.lang)), width));
		} else if (s.phase === "done") {
			const emoji =
				s.wpm >= 80 ? "🏆" : s.wpm >= 50 ? "🔥" : s.wpm >= 30 ? "👍" : "💪";
			const accLabel2 = gui("accuracy", this.lang);
			lines.push(
				centerPad(
					`${emoji} ${BOLD_GREEN(`${s.wpm} ${gui("wpm", this.lang)}`)} ${gui("with_", this.lang)}${s.accuracy >= 95 ? BOLD_GREEN(`${s.accuracy}% ${accLabel2}`) : BOLD_YELLOW(`${s.accuracy}% ${accLabel2}`)}`,
					width,
				),
			);
		}

		// Footer
		let footer: string;
		const newTestLabel = gui("newTest", this.lang);
		const startLabel = gui("startTyping", this.lang).replace("!", "");
		const typeLabel = gui("typeHere", this.lang);
		const fixLabel = gui("fix", this.lang);
		if (s.phase === "done")
			footer = `${BOLD("R")} ${newTestLabel}  ${DIM("|")}  ${BOLD(gui("quit", this.lang))}`;
		else if (s.phase === "ready")
			footer = `${BOLD(startLabel)} ${gui("startAction", this.lang)}  ${DIM("|")}  ${BOLD(gui("quit", this.lang))}`;
		else
			footer = `${BOLD(typeLabel)} ${gui("typeText", this.lang)}  ${DIM("|")}  ${BOLD("BACKSPACE")} ${fixLabel}  ${DIM("|")}  ${BOLD(gui("quit", this.lang))}`;
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
	en: `Typing Test - Speed Challenge

Type the displayed text as fast and accurately as you can.
Your WPM (words per minute) and accuracy are measured.`,
	zh: `打字测试 - 速度挑战

尽可能快速准确地输入显示的文字。
系统会测量你的打字速度（WPM）和准确率。`,
};

const SAVE_TYPE = "typing-save";

const gameTypingTest: GameModule = {
	meta: {
		id: "typing",
		name: "Typing Test",
		description: "Test your typing speed / 打字测速",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Typing Test requires interactive mode", "error");
				return;
			}

			const lang = getLang(ctx);

			const state = createInitialState();

			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				const comp = new TypingTestComponent(
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

		registerMenuEntry(gameTypingTest.meta, handler, SAVE_TYPE);
	},
};

export default gameTypingTest;
