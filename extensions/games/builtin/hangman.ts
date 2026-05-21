/**
 * Hangman - Guess the hidden word letter by letter.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey } from "@earendil-works/pi-tui";
import type { GameModule } from "../types.js";
import { type Lang, getLang, gui } from "../i18n.js";
import {
	BOLD,
	DIM,
	BOLD_GREEN,
	BOLD_RED,
	BOLD_MAGENTA,
	centerPad,
} from "../ansi.js";

type _Component = Component;

// ═══════════════════════════════════════════════════════════════════════════
// Word lists
// ═══════════════════════════════════════════════════════════════════════════

const WORDS: Record<string, string[]> = {
	Animal: [
		"elephant",
		"giraffe",
		"penguin",
		"dolphin",
		"cheetah",
		"kangaroo",
		"octopus",
		"butterfly",
		"crocodile",
		"flamingo",
	],
	Food: [
		"spaghetti",
		"avocado",
		"chocolate",
		"pineapple",
		"cinnamon",
		"broccoli",
		"mushroom",
		"sandwich",
		"blueberry",
		"pancake",
	],
	Country: [
		"australia",
		"portugal",
		"thailand",
		"argentina",
		"indonesia",
		"colombia",
		"morocco",
		"ethiopia",
		"singapore",
		"denmark",
	],
	Sport: [
		"basketball",
		"volleyball",
		"badminton",
		"wrestling",
		"gymnastics",
		"swimming",
		"archery",
		"fencing",
		"baseball",
		"cricket",
	],
	Movie: [
		"inception",
		"gladiator",
		"avatar",
		"titanic",
		"frozen",
		"matrix",
		"amelie",
		"jaws",
		"psycho",
		"alien",
	],
	Color: [
		"crimson",
		"turquoise",
		"magenta",
		"burgundy",
		"scarlet",
		"lavender",
		"maroon",
		"ivory",
		"charcoal",
		"cerulean",
	],
	Instrument: [
		"saxophone",
		"accordion",
		"harmonica",
		"mandolin",
		"clarinet",
		"trombone",
		"ukulele",
		"xylophone",
		"timpani",
		"banjo",
	],
	Fruit: [
		"strawberry",
		"watermelon",
		"raspberry",
		"blueberry",
		"pineapple",
		"pomegranate",
		"tangerine",
		"coconut",
		"dragonfruit",
		"persimmon",
	],
	Planet: [
		"mercury",
		"venus",
		"jupiter",
		"saturn",
		"neptune",
		"uranus",
		"pluto",
	],
	Vehicle: [
		"helicopter",
		"submarine",
		"motorcycle",
		"ambulance",
		"convertible",
		"locomotive",
		"hovercraft",
		"catamaran",
		"glider",
		"bicycle",
	],
};

// ═══════════════════════════════════════════════════════════════════════════
// Hangman ASCII art (7 stages, 0-6 wrong guesses)
// ═══════════════════════════════════════════════════════════════════════════

const HANGMAN_ART = [
	[
		"  +---+",
		"  |   |",
		"      |",
		"      |",
		"      |",
		"      |",
		"=========",
	],
	[
		"  +---+",
		"  |   |",
		"  O   |",
		"      |",
		"      |",
		"      |",
		"=========",
	],
	[
		"  +---+",
		"  |   |",
		"  O   |",
		"  |   |",
		"      |",
		"      |",
		"=========",
	],
	[
		"  +---+",
		"  |   |",
		"  O   |",
		" /|   |",
		"      |",
		"      |",
		"=========",
	],
	[
		"  +---+",
		"  |   |",
		"  O   |",
		" /|\\  |",
		"      |",
		"      |",
		"=========",
	],
	[
		"  +---+",
		"  |   |",
		"  O   |",
		" /|\\  |",
		" /    |",
		"      |",
		"=========",
	],
	[
		"  +---+",
		"  |   |",
		"  O   |",
		" /|\\  |",
		" / \\  |",
		"      |",
		"=========",
	],
];

// ═══════════════════════════════════════════════════════════════════════════
// Game state
// ═══════════════════════════════════════════════════════════════════════════

interface GameState {
	word: string;
	category: string;
	guessed: string[];
	wrongCount: number;
	gameOver: boolean;
	won: boolean;
}

function newGame(): GameState {
	const cats = Object.keys(WORDS);
	const cat = cats[Math.floor(Math.random() * cats.length)];
	const words = WORDS[cat];
	const word = words[Math.floor(Math.random() * words.length)];
	return {
		word,
		category: cat,
		guessed: [],
		wrongCount: 0,
		gameOver: false,
		won: false,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class HangmanComponent implements _Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	constructor(
		private tui: { requestRender: () => void },
		private state: GameState,
		private onClose: () => void,
		private onGuess: (letter: string) => void,
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
		const letter = data.toLowerCase();
		if (/^[a-z]$/.test(letter) && !this.state.guessed.includes(letter))
			this.onGuess(letter);
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const s = this.state;
		const lines: string[] = [];

		lines.push(centerPad(BOLD_MAGENTA("HANGMAN"), width));
		const categoryLabel = gui("selectMode", this.lang);
		lines.push(centerPad(DIM(`${categoryLabel}: ${s.category}`), width));
		lines.push("");

		// Hangman art
		const art = HANGMAN_ART[Math.min(s.wrongCount, 6)];
		for (const line of art) lines.push(centerPad(line, width));
		lines.push("");

		// Lives bar
		const remaining = 6 - s.wrongCount;
		const livesBar = "█".repeat(remaining) + "░".repeat(s.wrongCount);
		const livesLabel = gui("lives", this.lang);
		lines.push(centerPad(`${livesLabel}: ${BOLD_RED(livesBar)}`, width));
		lines.push("");

		// Word display
		let wordDisplay = "";
		for (const ch of s.word) {
			if (s.guessed.includes(ch)) wordDisplay += ` ${BOLD_GREEN(ch)} `;
			else wordDisplay += " _ ";
		}
		lines.push(centerPad(wordDisplay, width));
		lines.push("");

		// Guessed letters
		const sorted = [...s.guessed].sort();
		const guessedLabel = gui("guessLabel", this.lang);
		if (sorted.length > 0)
			lines.push(
				centerPad(DIM(`${guessedLabel}: ${sorted.join(", ")}`), width),
			);
		lines.push("");

		let footer: string;
		const wordWas = gui("wordWas", this.lang);
		if (s.gameOver) {
			footer = s.won
				? `${BOLD_GREEN(gui("youWin", this.lang))} ${wordWas} "${BOLD(s.word)}"  ${BOLD(gui("restart", this.lang))}`
				: `${BOLD_RED(gui("gameOver", this.lang))} ${wordWas} "${BOLD(s.word)}"  ${BOLD(gui("restart", this.lang))}`;
		} else {
			footer = `${BOLD("A-Z")} ${gui("guessLabel", this.lang)}  ${DIM("|")}  ${BOLD(gui("quit", this.lang))}`;
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
// GameModule export
// ═══════════════════════════════════════════════════════════════════════════

const INTRO = {
	en: `Hangman - Guess the Word

Type letters to guess the hidden word. You have 6 wrong guesses before the hangman is complete.
Press ENTER for a new game after win/loss.`,
	zh: `吊死鬼 - 猜单词

输入字母猜测隐藏的单词。最多允许猜错 6 次。
胜负已定后按 ENTER 开始新一局。`,
};

const SAVE_TYPE = "hangman-save";

const gameHangman: GameModule = {
	meta: {
		id: "hangman",
		name: "Hangman",
		description: "Guess the word / 猜单词",
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
				let comp: HangmanComponent | null = null;
				comp = new HangmanComponent(
					tui,
					state!,
					() => {
						comp = null;
						// Save on exit
						pi.appendEntry(SAVE_TYPE, state!);
						done(undefined);
					},
					(letter) => {
						state!.guessed.push(letter);
						if (!state!.word.includes(letter)) state!.wrongCount++;
						if (state!.wrongCount >= 6) {
							state!.gameOver = true;
							state!.won = false;
						} else if (
							[...state!.word].every((c) => state!.guessed.includes(c))
						) {
							state!.gameOver = true;
							state!.won = true;
						}
						comp?.updateState(state!);
					},
					lang,
				);
				return comp;
			});
		};

		registerMenuEntry(gameHangman.meta, handler, SAVE_TYPE);
	},
};

export default gameHangman;
