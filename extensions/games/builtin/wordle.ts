/**
 * Wordle - 5-letter word, 6 guesses, position feedback.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey } from "@earendil-works/pi-tui";
import type { GameModule, GameMeta } from "../types.js";
import { type Lang, getLang, gui } from "../i18n.js";
import {
	BOLD,
	DIM,
	GREEN,
	YELLOW,
	BOLD_GREEN,
	BOLD_RED,
	BOLD_YELLOW,
	centerPad,
} from "../ansi.js";

type _Component = Component;

// ═══════════════════════════════════════════════════════════════════════════
// Word list
// ═══════════════════════════════════════════════════════════════════════════

const WORD_LIST = [
	"apple",
	"beach",
	"chair",
	"dance",
	"eagle",
	"flame",
	"grape",
	"heart",
	"ivory",
	"jewel",
	"knife",
	"lemon",
	"mango",
	"noble",
	"ocean",
	"piano",
	"queen",
	"river",
	"stone",
	"tiger",
	"umbra",
	"vivid",
	"whale",
	"yacht",
	"zebra",
	"blaze",
	"charm",
	"drift",
	"ember",
	"frost",
	"globe",
	"haste",
	"input",
	"jolly",
	"knack",
	"lunar",
	"melon",
	"nexus",
	"oasis",
	"prism",
	"quilt",
	"roost",
	"spark",
	"trail",
	"unity",
	"vault",
	"wrist",
	"xenon",
	"yield",
	"zesty",
	"about",
	"above",
	"abuse",
	"actor",
	"acute",
	"admit",
	"adopt",
	"adult",
	"after",
	"again",
	"agent",
	"agree",
	"ahead",
	"alarm",
	"album",
	"alert",
	"alien",
	"align",
	"alive",
	"allow",
	"alone",
	"along",
	"alter",
	"among",
	"anger",
	"angle",
	"angry",
	"apart",
	"apple",
	"apply",
	"arena",
	"argue",
	"arise",
	"armor",
	"array",
	"aside",
	"asset",
	"avoid",
	"award",
	"aware",
];

// ═══════════════════════════════════════════════════════════════════════════
// Game logic
// ═══════════════════════════════════════════════════════════════════════════

interface GuessResult {
	letter: string;
	status: "correct" | "present" | "absent";
}
interface GameState {
	answer: string;
	guesses: GuessResult[][];
	currentInput: string;
	gameOver: boolean;
	won: boolean;
	maxGuesses: number;
}

function newGame(): GameState {
	return {
		answer: WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)],
		guesses: [],
		currentInput: "",
		gameOver: false,
		won: false,
		maxGuesses: 6,
	};
}

function evaluate(guess: string, answer: string): GuessResult[] {
	const result: GuessResult[] = guess
		.split("")
		.map((l) => ({ letter: l, status: "absent" as const }));
	const ansArr = answer.split("");
	// First pass: correct positions
	for (let i = 0; i < 5; i++) {
		if (guess[i] === answer[i]) {
			result[i].status = "correct";
			ansArr[i] = "";
		}
	}
	// Second pass: present but wrong position
	for (let i = 0; i < 5; i++) {
		if (result[i].status === "correct") continue;
		const idx = ansArr.indexOf(guess[i]);
		if (idx !== -1) {
			result[i].status = "present";
			ansArr[idx] = "";
		}
	}
	return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class WordleComponent implements _Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	private keyStatus: Record<
		string,
		"correct" | "present" | "absent" | undefined
	> = {};
	constructor(
		private tui: { requestRender: () => void },
		private state: GameState,
		private onClose: () => void,
		private onSubmit: (word: string) => void,
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
		if (this.state.gameOver) {
			if (data === "r") this.onClose();
			return true;
		}
		if (matchesKey(data, "return")) {
			if (this.state.currentInput.length === 5)
				this.onSubmit(this.state.currentInput);
			return true;
		}
		if (matchesKey(data, "backspace") || matchesKey(data, "delete")) {
			if (this.state.currentInput.length > 0) {
				this.state.currentInput = this.state.currentInput.slice(0, -1);
				this.version++;
				this.tui.requestRender();
			}
			return true;
		}
		const letter = data.toLowerCase();
		if (/^[a-z]$/.test(letter) && this.state.currentInput.length < 5) {
			this.state.currentInput += letter;
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

		lines.push(
			centerPad(
				BOLD_GREEN("W") +
					BOLD_YELLOW("O") +
					BOLD("R") +
					BOLD_GREEN("D") +
					BOLD_YELLOW("L") +
					BOLD("E"),
				width,
			),
		);
		lines.push("");

		// Legend
		const correctLabel = gui("correctPos", this.lang);
		const presentLabel = gui("correctPos", this.lang);
		const absentLabel = gui("misses", this.lang);
		lines.push(
			centerPad(
				`${GREEN("■")} = ${correctLabel}  ${YELLOW("■")} = ${presentLabel}  ${DIM("■")} = ${absentLabel}`,
				width,
			),
		);
		lines.push("");

		// Board
		for (let g = 0; g < s.maxGuesses; g++) {
			let row = "";
			if (g < s.guesses.length) {
				for (const r of s.guesses[g]) {
					if (r.status === "correct")
						row += ` ${BOLD_GREEN(` ${r.letter.toUpperCase()} `)} `;
					else if (r.status === "present")
						row += ` ${BOLD_YELLOW(` ${r.letter.toUpperCase()} `)} `;
					else row += ` ${DIM(` ${r.letter.toUpperCase()} `)} `;
				}
			} else if (g === s.guesses.length && !s.gameOver) {
				for (let i = 0; i < 5; i++) {
					if (i < s.currentInput.length)
						row += ` ${BOLD(` ${s.currentInput[i].toUpperCase()} `)} `;
					else row += ` ${DIM(" _ ")} `;
				}
			} else {
				for (let i = 0; i < 5; i++) row += ` ${DIM(" · ")} `;
			}
			lines.push(centerPad(row, width));
		}

		lines.push("");

		// Keyboard
		const kbRows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
		for (const kbRow of kbRows) {
			let line = "";
			for (const ch of kbRow) {
				const st = this.keyStatus[ch];
				const letter = ch.toUpperCase();
				if (st === "correct") line += BOLD_GREEN(` ${letter} `);
				else if (st === "present") line += BOLD_YELLOW(` ${letter} `);
				else if (st === "absent") line += DIM(` ${letter} `);
				else line += ` ${letter} `;
			}
			lines.push(centerPad(line, width));
		}

		lines.push("");
		let footer: string;
		const guessLabel = gui("guessLabel", this.lang);
		if (s.gameOver) {
			const brilliantLabel = gui("brilliant", this.lang);
			const gotItLabel = gui("gotItIn", this.lang);
			const wordWas = gui("wordWas", this.lang);
			footer = s.won
				? `${BOLD_GREEN(brilliantLabel)} ${gotItLabel} ${s.guesses.length}!  ${BOLD(gui("restart", this.lang))}`
				: `${BOLD_RED(gui("gameOver", this.lang))} ${wordWas} "${BOLD(s.answer)}"  ${BOLD(gui("restart", this.lang))}`;
		} else {
			footer = `${guessLabel} ${s.guesses.length + 1}/${s.maxGuesses}  ${DIM("|")}  ${gui("typeLetters", this.lang)} ${BOLD("ENTER")}`;
		}
		lines.push(centerPad(footer, width));
		lines.push("", DIM("─".repeat(width)));
		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}

	updateKeyStatus(guesses: GuessResult[][]) {
		for (const guess of guesses)
			for (const r of guess) {
				const cur = this.keyStatus[r.letter];
				if (r.status === "correct") this.keyStatus[r.letter] = "correct";
				else if (r.status === "present" && cur !== "correct")
					this.keyStatus[r.letter] = "present";
				else if (r.status === "absent" && !cur)
					this.keyStatus[r.letter] = "absent";
			}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// GameModule export
// ═══════════════════════════════════════════════════════════════════════════

const INTRO = {
	en: `Wordle - Five Letter Guessing

Type a 5-letter word and press ENTER to submit.
Green = correct position, Yellow = wrong position, Gray = not in word. 6 tries!`,
	zh: `猜词游戏 - 五字母推理

输入一个五字母单词后按 ENTER 提交。
绿色=位置正确，黄色=字母对位置错，灰色=不含该字母。共六次机会！`,
};

const SAVE_TYPE = "wordle-save";

const gameWordle: GameModule = {
	meta: {
		id: "wordle",
		name: "Wordle",
		description: "5 letters, 6 tries / 五字母六次猜",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Requires interactive mode", "error");
				return;
			}

			const lang = getLang(ctx);

			// Try to restore saved state
			const entries = ctx.sessionManager.getEntries();
			let state: GameState | undefined;
			for (let i = entries.length - 1; i >= 0; i--) {
				const e = entries[i];
				if (e.type === "custom" && e.customType === SAVE_TYPE) {
					const saved = e.data as GameState | null;
					if (saved && !saved.gameOver) state = saved;
					break;
				}
			}
			if (!state) state = newGame();

			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				let comp: WordleComponent | null = null;
				comp = new WordleComponent(
					tui,
					state!,
					() => {
						comp = null;
						// Save on exit
						pi.appendEntry(SAVE_TYPE, state!);
						done(undefined);
					},
					(word) => {
						const result = evaluate(word.toLowerCase(), state!.answer);
						state!.guesses.push(result);
						state!.currentInput = "";
						comp?.updateKeyStatus(state!.guesses);
						if (word.toLowerCase() === state!.answer) {
							state!.gameOver = true;
							state!.won = true;
						} else if (state!.guesses.length >= state!.maxGuesses) {
							state!.gameOver = true;
							state!.won = false;
						}
						comp?.updateState(state!);
					},
					lang,
				);
				// Restore keyboard status if resuming
				if (state!.guesses.length > 0) comp.updateKeyStatus(state!.guesses);
				return comp;
			});
		};

		registerMenuEntry(gameWordle.meta, handler, SAVE_TYPE);
	},
};

export default gameWordle;
