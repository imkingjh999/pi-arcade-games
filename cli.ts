#!/usr/bin/env node
/**
 * Standalone CLI for pi-arcade-games — play retro terminal games via npx.
 *
 * Usage:
 *   npx pi-arcade-games          # Show game menu
 *   npx pi-arcade-games snake    # Jump straight to a game
 */

import { matchesKey, visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { loadBuiltinGames } from "./extensions/games/loader.js";
import type { GameModule, GameMeta } from "./extensions/games/types.js";
import {
	type Lang,
	PREFS_SAVE_TYPE,
	getGameName,
	getGameDesc,
	MENU,
	t,
} from "./extensions/games/i18n.js";
import {
	BOLD,
	DIM,
	YELLOW,
	BOLD_GREEN,
	BOLD_CYAN,
	BOLD_YELLOW,
	centerPad,
	padEndVisible,
} from "./extensions/games/ansi.js";

// ═══════════════════════════════════════════════════════════════════════════
// Storage — JSON files in ~/.pi-arcade/
// ═══════════════════════════════════════════════════════════════════════════

const DATA_DIR = join(homedir(), ".pi-arcade");
const ENTRIES_FILE = join(DATA_DIR, "entries.json");

interface Entry {
	type: "custom";
	customType: string;
	data: unknown;
}

function ensureDataDir() {
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadEntries(): Entry[] {
	ensureDataDir();
	if (!existsSync(ENTRIES_FILE)) return [];
	try {
		return JSON.parse(readFileSync(ENTRIES_FILE, "utf-8"));
	} catch {
		return [];
	}
}

function appendEntry(customType: string, data: unknown) {
	const entries = loadEntries();
	entries.push({ type: "custom", customType, data });
	ensureDataDir();
	writeFileSync(ENTRIES_FILE, JSON.stringify(entries));
}

// ═══════════════════════════════════════════════════════════════════════════
// Component type (mirrors pi-tui Component)
// ═══════════════════════════════════════════════════════════════════════════

interface Component {
	render(width: number): string[];
	handleInput?(data: string): void | boolean;
	invalidate(): void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Terminal — raw mode + alternate screen buffer + render loop
// ═══════════════════════════════════════════════════════════════════════════

const SHOW_CURSOR = "\x1b[?25h";
const HIDE_CURSOR = "\x1b[?25l";
const ALT_SCREEN_ON = "\x1b[?1049h";
const ALT_SCREEN_OFF = "\x1b[?1049l";

/**
 * Run a Component in the terminal with raw input and alternate screen buffer.
 */
function runInTerminal<T>(
	factory: (
		tui: { requestRender: () => void },
		done: (result: T) => void,
	) => Component,
): Promise<T> {
	return new Promise((resolve) => {
		let resolved = false;
		let renderScheduled = false;

		const tui = {
			requestRender: () => {
				if (!renderScheduled) {
					renderScheduled = true;
					queueMicrotask(doRender);
				}
			},
		};

		const component = factory(tui, (result) => {
			if (resolved) return;
			resolved = true;
			cleanup();
			resolve(result);
		});

		process.stdout.write(ALT_SCREEN_ON + HIDE_CURSOR);
		process.stdin.setRawMode(true);
		process.stdin.resume();

		function doRender() {
			if (resolved) return;
			renderScheduled = false;
			const width = process.stdout.columns || 80;
			const height = process.stdout.rows || 24;
			const lines = component.render(width);
			// Truncate each line to terminal width to prevent auto-wrapping
			// and pad to fill screen height
			const result: string[] = [];
			for (let i = 0; i < height; i++) {
				const line = i < lines.length ? truncateToWidth(lines[i], width) : "";
				result.push(line);
			}
			let out = "\x1b[H";
			for (const line of result) {
				out += line + "\n";
			}
			process.stdout.write(out);
		}

		// Escape sequence buffer: arrow keys send multi-byte sequences like \x1b[A.
		// In raw mode, these may arrive as separate chunks (\x1b then [A).
		// We buffer \x1b for a short time to see if more bytes follow.
		let escBuf = "";
		let escTimer: ReturnType<typeof setTimeout> | null = null;

		function processInput(data: string) {
			if (data === "\x03") {
				if (!resolved) {
					resolved = true;
					cleanup();
					resolve(undefined as T);
				}
				return;
			}
			component.handleInput?.(data);
		}

		function onData(buf: Buffer) {
			if (resolved) return;
			const data = buf.toString();

			// If we have a pending escape buffer, append new data and flush
			if (escBuf) {
				if (escTimer) {
					clearTimeout(escTimer);
					escTimer = null;
				}
				const full = escBuf + data;
				escBuf = "";
				processInput(full);
				return;
			}

			// Start buffering if data begins with ESC and might be a sequence
			if (data === "\x1b") {
				escBuf = data;
				escTimer = setTimeout(() => {
					escTimer = null;
					escBuf = "";
					processInput("\x1b"); // standalone ESC
				}, 30);
				return;
			}

			processInput(data);
		}

		function onResize() {
			doRender();
		}

		function cleanup() {
			if (escTimer) {
				clearTimeout(escTimer);
				escTimer = null;
			}
			escBuf = "";
			process.stdin.removeListener("data", onData);
			process.stdout.removeListener("resize", onResize);
			process.stdin.setRawMode(false);
			process.stdin.pause();
			process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
		}

		process.stdin.on("data", onData);
		process.stdout.on("resize", onResize);
		doRender();
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// Mock Pi context for game modules
// ═══════════════════════════════════════════════════════════════════════════

function createMockCtx() {
	return {
		hasUI: true as const,
		ui: {
			custom: <T>(
				factory: (
					tui: { requestRender: () => void },
					_theme: unknown,
					_kb: unknown,
					done: (result: T) => void,
				) => Component,
			) =>
				runInTerminal<T>((tui, done) =>
					factory(tui, undefined, undefined, done),
				),
			notify: (_msg: string) => {},
		},
		sessionManager: {
			getEntries: () => loadEntries(),
			getBranch: () => [],
		},
	};
}

function createMockPi(): any {
	return {
		appendEntry: (type: string, data: unknown) => appendEntry(type, data),
		registerMessageRenderer: () => {},
		registerTool: () => {},
		sendMessage: () => {},
		setSessionName: () => {},
		on: () => {},
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Game Registry
// ═══════════════════════════════════════════════════════════════════════════

interface GameEntry {
	meta: GameMeta;
	saveType?: string;
	handler: (args: string, ctx: any) => Promise<void>;
	module?: GameModule;
}

const GAMES: GameEntry[] = [];

function registerMenuEntry(
	meta: GameMeta,
	handler: (args: string, ctx: any) => Promise<void>,
	saveType?: string,
) {
	GAMES.push({ meta, saveType, handler });
}

function detectSavedGames(): string[] {
	const entries = loadEntries();
	const savedIds: string[] = [];
	for (const game of GAMES) {
		if (!game.saveType) continue;
		for (let i = entries.length - 1; i >= 0; i--) {
			const e = entries[i];
			if (e.type === "custom" && e.customType === game.saveType) {
				const data = e.data as { gameOver?: boolean } | null;
				if (data && !data.gameOver) {
					savedIds.push(game.meta.id);
				}
				break;
			}
		}
	}
	return savedIds;
}

// ═══════════════════════════════════════════════════════════════════════════
// Language Selection Screen
// ═══════════════════════════════════════════════════════════════════════════

class LangSelectComponent implements Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	private selectedIndex = 0;

	constructor(
		private tui: { requestRender: () => void },
		private onSelect: (lang: Lang) => void,
		private onCancel: () => void,
	) {}

	invalidate() {
		this.cachedWidth = 0;
	}

	handleInput(data: string): boolean {
		if (matchesKey(data, "escape")) {
			this.onCancel();
			return true;
		}
		if (matchesKey(data, "up") && this.selectedIndex > 0) this.selectedIndex--;
		else if (matchesKey(data, "down") && this.selectedIndex < 1)
			this.selectedIndex++;
		else if (matchesKey(data, "return") || data === " ") {
			this.onSelect(this.selectedIndex === 0 ? "en" : "zh");
			return true;
		} else if (data === "1") {
			this.onSelect("en");
			return true;
		} else if (data === "2") {
			this.onSelect("zh");
			return true;
		}
		this.version++;
		this.tui.requestRender();
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const lines: string[] = [];
		lines.push("");
		lines.push(
			centerPad(
				BOLD_CYAN("╔══════════════════════════════════════════╗"),
				width,
			),
		);
		lines.push(
			centerPad(
				BOLD_CYAN("║") +
					BOLD("      P I   A R C A D E   G A M E S       ") +
					BOLD_CYAN("║"),
				width,
			),
		);
		lines.push(
			centerPad(
				BOLD_CYAN("╚══════════════════════════════════════════╝"),
				width,
			),
		);
		lines.push("");
		lines.push(centerPad(BOLD(MENU.langTitle.en), width));
		lines.push("");

		const sel0 = this.selectedIndex === 0;
		const num0 = padEndVisible(DIM("[1]"), 3);
		const label0 = sel0
			? `> ${num0}  ${BOLD_GREEN(padEndVisible("English", 10))}`
			: `  ${num0}  ${padEndVisible("English", 10)}`;
		lines.push(centerPad(label0, width));

		const sel1 = this.selectedIndex === 1;
		const num1 = padEndVisible(DIM("[2]"), 3);
		const label1 = sel1
			? `> ${num1}  ${BOLD_GREEN(padEndVisible("中文", 10))}`
			: `  ${num1}  ${padEndVisible("中文", 10)}`;
		lines.push(centerPad(label1, width));

		lines.push("");
		lines.push(
			centerPad(
				DIM(
					`${BOLD("↑↓")} select    ${BOLD("ENTER")} confirm    ${BOLD("1/2")} quick pick / 快捷选择`,
				),
				width,
			),
		);
		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Game Intro Screen
// ═══════════════════════════════════════════════════════════════════════════

class GameIntroComponent implements Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;

	constructor(
		_tui: { requestRender: () => void },
		private gameName: string,
		private introText: string,
		private lang: Lang,
		private onStart: () => void,
		private onBack: () => void,
	) {}

	invalidate() {
		this.cachedWidth = 0;
	}

	handleInput(data: string): boolean {
		if (matchesKey(data, "escape")) {
			this.onBack();
			return true;
		}
		if (matchesKey(data, "return") || data === " ") {
			this.onStart();
			return true;
		}
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedLines.length > 0)
			return this.cachedLines;
		const lines: string[] = [];
		lines.push("");
		lines.push(
			centerPad(
				BOLD_CYAN("┌") + BOLD_CYAN("─".repeat(38)) + BOLD_CYAN("┐"),
				width,
			),
		);
		const innerTitle = BOLD(`${this.gameName} - ${t("introTitle", this.lang)}`);
		lines.push(
			centerPad(
				BOLD_CYAN("│") + centerPad(innerTitle, 38) + BOLD_CYAN("│"),
				width,
			),
		);
		lines.push(
			centerPad(
				BOLD_CYAN("├") + BOLD_CYAN("─".repeat(38)) + BOLD_CYAN("┤"),
				width,
			),
		);
		const contentWidth = 36;
		const wrappedLines = wrapText(this.introText, contentWidth);
		for (const wl of wrappedLines) {
			lines.push(
				centerPad(
					BOLD_CYAN("│") +
						" " +
						padEndVisible(wl, contentWidth) +
						" " +
						BOLD_CYAN("│"),
					width,
				),
			);
		}
		lines.push(
			centerPad(
				BOLD_CYAN("└") + BOLD_CYAN("─".repeat(38)) + BOLD_CYAN("┘"),
				width,
			),
		);
		lines.push("");
		lines.push(centerPad(BOLD_GREEN(t("introPressEnter", this.lang)), width));
		lines.push(centerPad(DIM(t("introPressQ", this.lang)), width));
		this.cachedLines = lines;
		this.cachedWidth = width;
		return lines;
	}
}

function wrapText(text: string, maxWidth: number): string[] {
	const lines: string[] = [];
	for (const paragraph of text.split("\n")) {
		if (paragraph === "") {
			lines.push("");
			continue;
		}
		let current = "";
		for (const char of paragraph) {
			if (visibleWidth(current + char) > maxWidth) {
				lines.push(current);
				current = char;
			} else {
				current += char;
			}
		}
		if (current) lines.push(current);
	}
	return lines;
}

// ═══════════════════════════════════════════════════════════════════════════
// Arcade Menu
// ═══════════════════════════════════════════════════════════════════════════

class ArcadeMenuComponent implements Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	private selectedIndex = 0;
	private savedGames: Set<string>;
	private digitBuf = "";
	private digitTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private tui: { requestRender: () => void },
		private onClose: () => void,
		private onSelect: (game: GameEntry) => void,
		savedGameIds: string[],
		private lang: Lang,
	) {
		this.savedGames = new Set(savedGameIds);
	}

	invalidate() {
		this.cachedWidth = 0;
	}

	private flushDigitBuf(): void {
		if (this.digitTimer) {
			clearTimeout(this.digitTimer);
			this.digitTimer = null;
		}
		if (this.digitBuf) {
			const num = parseInt(this.digitBuf, 10);
			this.digitBuf = "";
			if (num >= 1 && num <= GAMES.length) {
				this.onSelect(GAMES[num - 1]);
				return;
			}
		}
		this.version++;
		this.tui.requestRender();
	}

	handleInput(data: string): boolean {
		if (matchesKey(data, "escape")) {
			this.digitBuf = "";
			if (this.digitTimer) {
				clearTimeout(this.digitTimer);
				this.digitTimer = null;
			}
			this.onClose();
			return true;
		}
		if (matchesKey(data, "up") && this.selectedIndex > 0) this.selectedIndex--;
		else if (matchesKey(data, "down") && this.selectedIndex < GAMES.length - 1)
			this.selectedIndex++;
		else if (matchesKey(data, "return") || data === " ") {
			if (this.digitBuf) {
				this.flushDigitBuf();
				return true;
			}
			if (GAMES[this.selectedIndex]) this.onSelect(GAMES[this.selectedIndex]);
			return true;
		} else if (matchesKey(data, "home")) this.selectedIndex = 0;
		else if (matchesKey(data, "end")) this.selectedIndex = GAMES.length - 1;
		else if (matchesKey(data, "pageUp"))
			this.selectedIndex = Math.max(0, this.selectedIndex - 9);
		else if (matchesKey(data, "pageDown"))
			this.selectedIndex = Math.min(GAMES.length - 1, this.selectedIndex + 9);
		else if (data.length === 1 && data >= "0" && data <= "9") {
			this.digitBuf += data;
			const num = parseInt(this.digitBuf, 10);
			if (this.digitBuf.length >= 3 || num * 10 > GAMES.length) {
				this.flushDigitBuf();
			} else {
				if (this.digitTimer) clearTimeout(this.digitTimer);
				this.digitTimer = setTimeout(() => this.flushDigitBuf(), 600);
			}
			this.version++;
			this.tui.requestRender();
			return true;
		}
		this.version++;
		this.tui.requestRender();
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const lang = this.lang;
		const lines: string[] = [];

		lines.push(
			centerPad(
				BOLD_CYAN("╔══════════════════════════════════════════╗"),
				width,
			),
		);
		lines.push(
			centerPad(
				BOLD_CYAN("║") +
					BOLD("      P I   A R C A D E   G A M E S       ") +
					BOLD_CYAN("║"),
				width,
			),
		);
		lines.push(
			centerPad(
				BOLD_CYAN("╚══════════════════════════════════════════╝"),
				width,
			),
		);
		lines.push("");

		const gameNames = GAMES.map((g) => getGameName(g.meta.id, lang));
		const gameDescs = GAMES.map((g) => getGameDesc(g.meta.id, lang));
		const maxDescLen = Math.max(...gameDescs.map((d) => visibleWidth(d)), 1);
		const numWidth = String(GAMES.length).length;

		const gameLines: string[] = [];
		for (let i = 0; i < GAMES.length; i++) {
			const g = GAMES[i];
			const selected = i === this.selectedIndex;
			const hasSave = this.savedGames.has(g.meta.id);
			const prefix = selected ? `${BOLD_GREEN(">")}` : " ";
			const numStr = String(i + 1).padStart(numWidth);
			const num = selected ? BOLD_GREEN(`[${numStr}]`) : DIM(`[${numStr}]`);
			const name = selected
				? BOLD(padEndVisible(gameNames[i], 15))
				: padEndVisible(gameNames[i], 15);
			const desc = selected
				? BOLD_CYAN(padEndVisible(gameDescs[i], maxDescLen))
				: DIM(padEndVisible(gameDescs[i], maxDescLen));
			const saveBadge = hasSave ? BOLD_YELLOW(" 💾") : "";
			const sep = DIM(" ··· ");
			gameLines.push(`${prefix} ${num}  ${name}${sep}${desc}${saveBadge}`);
		}

		const maxGameLineWidth = Math.max(...gameLines.map((l) => visibleWidth(l)));
		const gameLeftPad = Math.max(0, Math.floor((width - maxGameLineWidth) / 2));
		for (const line of gameLines) {
			lines.push(" ".repeat(gameLeftPad) + line);
		}

		const savedNames = GAMES.filter((g) => this.savedGames.has(g.meta.id)).map(
			(g) => getGameName(g.meta.id, lang),
		);
		if (savedNames.length > 0) {
			lines.push("");
			lines.push(
				centerPad(
					YELLOW(`💾 ${t("continueLabel", lang)} ${savedNames.join(", ")}`),
					width,
				),
			);
		}

		lines.push("");
		if (this.digitBuf) {
			lines.push(
				centerPad(
					BOLD_YELLOW(`▶ ${t("jumpTo", lang)}${this.digitBuf}...`),
					width,
				),
			);
		} else {
			const jumpHint =
				GAMES.length <= 9
					? `${BOLD("1-9")} ${t("jumpHint", lang)}  `
					: `${BOLD("1-" + GAMES.length)} ${t("jumpHint", lang)}  ${BOLD("PgUp/PgDn")} ${t("scrollHint", lang)}  `;
			lines.push(
				centerPad(
					DIM(
						`${BOLD(t("selectHint", lang))}  ${BOLD(t("playHint", lang))}  ${jumpHint}${BOLD(t("quitHint", lang))}`,
					),
					width,
				),
			);
		}
		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

/** Games that require Pi agent interaction and cannot run standalone */
const AGENT_GAMES = new Set(["gomoku"]);

async function main() {
	if (!process.stdin.isTTY) {
		console.error("Error: pi-arcade-games requires an interactive terminal.");
		console.error("Usage: npx pi-arcade-games [game-name]");
		process.exit(1);
	}

	const arg = process.argv[2]?.trim().toLowerCase();

	// Load all builtin games
	const modules = await loadBuiltinGames();
	const pi = createMockPi();

	for (const game of modules) {
		if (AGENT_GAMES.has(game.meta.id)) continue;
		game.register(pi, (meta: GameMeta, handler: any, saveType?: string) => {
			registerMenuEntry(meta, handler, saveType);
			const entry = GAMES[GAMES.length - 1];
			entry.module = game;
		});
	}

	// Sort games alphabetically by id
	GAMES.sort((a, b) => a.meta.id.localeCompare(b.meta.id));

	// Direct game launch via argument
	if (arg) {
		const entry = GAMES.find(
			(g) => g.meta.id === arg || g.meta.name.toLowerCase() === arg,
		);
		if (!entry) {
			console.error(`Game not found: ${arg}`);
			console.error(`Available: ${GAMES.map((g) => g.meta.id).join(", ")}`);
			process.exit(1);
		}
		const ctx = createMockCtx();
		await entry.handler("", ctx);
		return;
	}

	// Interactive menu
	const entries = loadEntries();
	let prefs = { lang: "en" as Lang, visitedGames: [] as string[] };
	const hasPrefs = entries.some(
		(e) => e.type === "custom" && e.customType === PREFS_SAVE_TYPE,
	);
	if (hasPrefs) {
		for (let i = entries.length - 1; i >= 0; i--) {
			if (
				entries[i].type === "custom" &&
				entries[i].customType === PREFS_SAVE_TYPE
			) {
				prefs = entries[i].data as typeof prefs;
				break;
			}
		}
	}

	// First run: language selection
	if (!hasPrefs) {
		const lang = await runInTerminal<Lang | null>((tui, done) => {
			return new LangSelectComponent(
				tui,
				(lang) => done(lang),
				() => done(null),
			);
		});
		if (!lang) return;
		prefs = { lang, visitedGames: [] };
		appendEntry(PREFS_SAVE_TYPE, prefs);
	}

	// Game menu loop
	while (true) {
		const savedGameIds = detectSavedGames();
		const selection = await runInTerminal<GameEntry | null>((tui, done) => {
			return new ArcadeMenuComponent(
				tui,
				() => done(null),
				(game) => done(game),
				savedGameIds,
				prefs.lang,
			);
		});
		if (!selection?.handler) break;

		// Show intro for first-time games
		const isVisited = prefs.visitedGames.includes(selection.meta.id);
		if (!isVisited && selection.module?.intro) {
			const introText =
				selection.module.intro[prefs.lang] || selection.module.intro.en;
			const gameName = getGameName(selection.meta.id, prefs.lang);
			const shouldStart = await runInTerminal<boolean>((tui, done) => {
				return new GameIntroComponent(
					tui,
					gameName,
					introText,
					prefs.lang,
					() => done(true),
					() => done(false),
				);
			});
			if (!shouldStart) continue;
		}

		// Mark as visited
		if (!isVisited) {
			prefs.visitedGames = [...prefs.visitedGames, selection.meta.id];
			appendEntry(PREFS_SAVE_TYPE, prefs);
		}

		// Run the game
		const ctx = createMockCtx();
		await selection.handler("", ctx);
	}
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
