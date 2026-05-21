/**
 * Pi Arcade - Retro terminal games for Pi coding agent.
 *
 * Single entry point: /game
 *   - First run: language selection screen
 *   - Shows game menu with translated names/descriptions
 *   - First play of each game: shows game intro
 *   - Select a game to start fresh or continue from where you left off
 *
 * Configuration:
 *   - PI_ARCADE_REGISTRY: URL to a game registry JSON manifest
 *   - PI_ARCADE_LOCAL_GAMES: colon-separated list of local game paths
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
import {
	BOLD,
	DIM,
	GREEN,
	CYAN,
	YELLOW,
	BOLD_GREEN,
	BOLD_CYAN,
	BOLD_YELLOW,
	centerPad,
	padEndVisible,
} from "./games/ansi.js";
import type { GameMeta, GameModule } from "./games/types.js";
import {
	type Lang,
	type ArcadePrefs,
	PREFS_SAVE_TYPE,
	getPrefs,
	getGameName,
	getGameDesc,
	MENU,
	t,
} from "./games/i18n.js";
import { loadAndRegisterAll } from "./games/loader.js";

// ═══════════════════════════════════════════════════════════════════════════
// GAME REGISTRY (populated by loader at startup)
// ═══════════════════════════════════════════════════════════════════════════

interface GameEntry {
	meta: GameMeta;
	saveType?: string;
	handler?: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
	module?: GameModule;
}

const GAMES: GameEntry[] = [];

function registerMenuEntry(
	meta: GameMeta,
	handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>,
	saveType?: string,
	module?: GameModule,
) {
	const existing = GAMES.findIndex((g) => g.meta.id === meta.id);
	const entry: GameEntry = { meta, saveType, handler, module };
	if (existing >= 0) {
		// Builtin games should never be overwritten by remote/local ones
		if (
			GAMES[existing].meta.source === "builtin" &&
			meta.source !== "builtin"
		) {
			return;
		}
		GAMES[existing] = entry;
	} else {
		GAMES.push(entry);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// LANGUAGE SELECTION SCREEN
// ═══════════════════════════════════════════════════════════════════════════

type _Component = Component;

class LangSelectComponent implements _Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	private selectedIndex = 0; // 0 = English, 1 = 中文

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

		// Option 1: English
		const sel0 = this.selectedIndex === 0;
		const numW0 = 3; // "[1]"
		const labelW = 10;
		const label0 = padEndVisible("English", labelW);
		const num0 = padEndVisible(DIM("[1]"), numW0);
		const opt0 = sel0
			? `> ${num0}  ${BOLD_GREEN(label0)}`
			: `  ${num0}  ${label0}`;
		lines.push(centerPad(opt0, width));

		// Option 2: 中文
		const sel1 = this.selectedIndex === 1;
		const label1 = padEndVisible("中文", labelW);
		const num1 = padEndVisible(DIM("[2]"), numW0);
		const opt1 = sel1
			? `> ${num1}  ${BOLD_GREEN(label1)}`
			: `  ${num1}  ${label1}`;
		lines.push(centerPad(opt1, width));

		lines.push("");
		lines.push(
			centerPad(
				DIM(
					`${BOLD("↑↓")} select    ${BOLD("ENTER")} confirm    ${BOLD("1/2")} quick pick / 快捷选择`,
				),
				width,
			),
		);
		lines.push("", DIM("─".repeat(width)));

		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME INTRO SCREEN
// ═══════════════════════════════════════════════════════════════════════════

class GameIntroComponent implements _Component {
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

		// Title
		const innerTitle = BOLD(`${this.gameName} - ${t("introTitle", this.lang)}`);
		const titleLine =
			BOLD_CYAN("│") + centerPad(innerTitle, 38) + BOLD_CYAN("│");
		lines.push(centerPad(titleLine, width));

		lines.push(
			centerPad(
				BOLD_CYAN("├") + BOLD_CYAN("─".repeat(38)) + BOLD_CYAN("┤"),
				width,
			),
		);

		// Intro text - word wrap to fit inside the box
		const contentWidth = 36;
		const wrappedLines = wrapText(this.introText, contentWidth);
		for (const wl of wrappedLines) {
			const padded = padEndVisible(wl, contentWidth);
			lines.push(
				centerPad(BOLD_CYAN("│") + " " + padded + " " + BOLD_CYAN("│"), width),
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
		lines.push("", DIM("─".repeat(width)));

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
// ARCADE MENU (i18n aware)
// ═══════════════════════════════════════════════════════════════════════════

class ArcadeMenuComponent implements _Component {
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
			// If user was typing a multi-digit number, flush it on Enter
			if (this.digitBuf) {
				this.flushDigitBuf();
				return true;
			}
			if (GAMES[this.selectedIndex]) {
				this.onSelect(GAMES[this.selectedIndex]);
			}
			return true;
		} else if (matchesKey(data, "home")) {
			this.selectedIndex = 0;
		} else if (matchesKey(data, "end")) {
			this.selectedIndex = GAMES.length - 1;
		} else if (matchesKey(data, "pageUp")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 9);
		} else if (matchesKey(data, "pageDown")) {
			this.selectedIndex = Math.min(GAMES.length - 1, this.selectedIndex + 9);
		} else {
			// Accumulate digit input for multi-digit game numbers (1-999)
			if (data.length === 1 && data >= "0" && data <= "9") {
				this.digitBuf += data;
				// Auto-select if the buffer already exceeds the game count or reaches 3 digits
				const num = parseInt(this.digitBuf, 10);
				if (this.digitBuf.length >= 3 || num * 10 > GAMES.length) {
					this.flushDigitBuf();
				} else {
					// Set a 600ms timeout to auto-flush (e.g. user types "1" for game 1)
					if (this.digitTimer) clearTimeout(this.digitTimer);
					this.digitTimer = setTimeout(() => this.flushDigitBuf(), 600);
				}
				this.version++;
				this.tui.requestRender();
				return true;
			}
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

		// Build game lines with i18n names/descriptions
		const gameNames = GAMES.map((g) => getGameName(g.meta.id, lang));
		const gameDescs = GAMES.map((g) => getGameDesc(g.meta.id, lang));
		const maxDescLen = Math.max(...gameDescs.map((d) => visibleWidth(d)), 1);
		const numWidth = String(GAMES.length).length;

		// Build all game lines first, then apply consistent left padding
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
			const sourceBadge =
				g.meta.source === "remote"
					? CYAN(" ☁")
					: g.meta.source === "local"
						? GREEN(" 📁")
						: "";
			const sep = DIM(" ··· ");

			gameLines.push(
				`${prefix} ${num}  ${name}${sep}${desc}${saveBadge}${sourceBadge}`,
			);
		}

		// Uniform left-pad based on the widest game line
		const maxGameLineWidth = Math.max(...gameLines.map((l) => visibleWidth(l)));
		const gameLeftPad = Math.max(0, Math.floor((width - maxGameLineWidth) / 2));
		for (const line of gameLines) {
			lines.push(" ".repeat(gameLeftPad) + line);
		}

		// Show continue hint if any game has a save
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
		// Show digit input buffer if active
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
		lines.push("", DIM("─".repeat(width)));
		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default async function (pi: ExtensionAPI) {
	// ── Load all games ────────────────────────────────────────────────
	const registryUrl = process.env.PI_ARCADE_REGISTRY;
	const localGames =
		process.env.PI_ARCADE_LOCAL_GAMES?.split(":").filter(Boolean);

	const loadedModules = await loadAndRegisterAll(pi, registerMenuEntry, {
		registryUrl,
		localGames,
	});

	// Enrich GAMES entries with module references (for intro text)
	for (const mod of loadedModules) {
		const entry = GAMES.find((g) => g.meta.id === mod.meta.id);
		if (entry) entry.module = mod;
	}

	// ── Helper: detect saved games ────────────────────────────────────
	function detectSavedGames(ctx: ExtensionCommandContext): string[] {
		const entries = ctx.sessionManager.getEntries();
		const savedIds: string[] = [];
		for (const game of GAMES) {
			if (!game.saveType) continue;
			for (let i = entries.length - 1; i >= 0; i--) {
				const e = entries[i];
				if (e.type === "custom" && e.customType === game.saveType) {
					const data = e.data as { gameOver?: boolean } | null;
					// Only count as "has save" if the data is non-null and game not over
					if (data && !data.gameOver) {
						savedIds.push(game.meta.id);
					}
					break;
				}
			}
		}
		return savedIds;
	}

	// ── Helper: save prefs via pi.appendEntry ─────────────────────────
	function savePrefs(prefs: ArcadePrefs): void {
		pi.appendEntry(PREFS_SAVE_TYPE, prefs);
	}

	// ── Language selection (if no prefs yet) ───────────────────────────
	async function selectLanguage(
		ctx: ExtensionCommandContext,
	): Promise<Lang | null> {
		let chosen: Lang | null = null;
		await ctx.ui.custom<Lang | null>((tui, _theme, _kb, done) => {
			return new LangSelectComponent(
				tui,
				(lang) => {
					chosen = lang;
					done(lang);
				},
				() => {
					chosen = null;
					done(null);
				},
			);
		});
		return chosen;
	}

	// ── Game intro (for first-time players) ───────────────────────────
	async function showGameIntro(
		ctx: ExtensionCommandContext,
		game: GameEntry,
		lang: Lang,
	): Promise<boolean> {
		// Only show if game has intro text
		if (!game.module?.intro) return true; // proceed to play

		const introText = game.module.intro[lang] || game.module.intro.en;
		const gameName = getGameName(game.meta.id, lang);

		let shouldStart = true;
		await ctx.ui.custom<void>((tui, _theme, _kb, done) => {
			return new GameIntroComponent(
				tui,
				gameName,
				introText,
				lang,
				() => {
					shouldStart = true;
					done(undefined);
				},
				() => {
					shouldStart = false;
					done(undefined);
				},
			);
		});
		return shouldStart;
	}

	// ── Game menu command ─────────────────────────────────────────────
	pi.registerCommand("game", {
		description: "Open the game menu",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Arcade requires interactive mode", "error");
				return;
			}

			// Check if language has been set before
			let prefs = getPrefs(ctx);
			const isFirstRun = !ctx.sessionManager
				.getEntries()
				.some((e) => e.type === "custom" && e.customType === PREFS_SAVE_TYPE);

			if (isFirstRun) {
				const lang = await selectLanguage(ctx);
				if (!lang) return; // user cancelled
				prefs = { lang, visitedGames: [] };
				savePrefs(prefs);
			}

			// After a game exits, loop back to menu (so user can play another)
			while (true) {
				const savedGameIds = detectSavedGames(ctx);
				let selectedGame: GameEntry | undefined;
				let quitMenu = false;
				await ctx.ui.custom<void>((tui, _theme, _kb, done) => {
					return new ArcadeMenuComponent(
						tui,
						() => {
							quitMenu = true;
							done(undefined);
						},
						(game) => {
							selectedGame = game;
							done(undefined);
						},
						savedGameIds,
						prefs.lang,
					);
				});
				if (quitMenu || !selectedGame?.handler) break;

				// Check if this game needs an intro (first time playing)
				const gameEntry = selectedGame;
				const isVisited = prefs.visitedGames.includes(gameEntry.meta.id);

				if (!isVisited && gameEntry.module?.intro) {
					const shouldStart = await showGameIntro(ctx, gameEntry, prefs.lang);
					if (!shouldStart) continue; // back to menu
				}

				// Mark game as visited
				if (!isVisited) {
					prefs.visitedGames = [...prefs.visitedGames, gameEntry.meta.id];
					savePrefs(prefs);
				}

				if (gameEntry.handler) await gameEntry.handler("", ctx);
			}
		},
	});

	// ── Dynamic game loading commands ─────────────────────────────────

	pi.registerCommand("game-install", {
		description:
			"Install a game from a URL or local path (.js / .ts GameModule)",
		handler: async (args, ctx) => {
			let input = args.trim();
			if (!input) {
				ctx.ui.notify("Usage: /game-install <url-or-path-to-game>", "info");
				return;
			}

			// Strip surrounding quotes (users often paste paths as 'path' or "path")
			if (
				(input.startsWith("'") && input.endsWith("'")) ||
				(input.startsWith('"') && input.endsWith('"'))
			) {
				input = input.slice(1, -1);
			}

			const isLocalPath =
				input.startsWith("/") ||
				input.startsWith("./") ||
				input.startsWith("../") ||
				(input.length > 1 && input[1] === ":"); // Windows absolute path like C:\...

			try {
				const { fetchRemoteGame, loadLocalGame, loadTsGame } = await import(
					"./games/loader.js"
				);

				if (isLocalPath) {
					ctx.ui.notify(`Loading local game: ${input}...`, "info");
					const game = input.endsWith(".ts")
						? await loadTsGame(input)
						: await loadLocalGame(input);
					game.register(pi, registerMenuEntry);
					ctx.ui.notify(
						`Installed: ${game.meta.name} (${game.meta.id})`,
						"info",
					);
				} else {
					ctx.ui.notify(`Fetching game from ${input}...`, "info");
					const game = await fetchRemoteGame(input);
					game.register(pi, registerMenuEntry);
					ctx.ui.notify(
						`Installed: ${game.meta.name} (${game.meta.id})`,
						"info",
					);
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				const hint =
					!isLocalPath && msg.includes("Invalid URL")
						? ` (not a valid URL — if this is a file path, use an absolute path starting with / or a relative path like ./game.js)`
						: "";
				ctx.ui.notify(`Failed: ${msg}${hint}`, "error");
			}
		},
	});

	pi.registerCommand("game-list", {
		description: "List all available games",
		handler: async (_args, ctx) => {
			const prefs = getPrefs(ctx);
			const lang = prefs.lang;
			const entries = ctx.sessionManager.getEntries();
			const lines = GAMES.map((g) => {
				let save = "";
				if (g.saveType) {
					for (let i = entries.length - 1; i >= 0; i--) {
						const e = entries[i];
						if (e.type === "custom" && e.customType === g.saveType) {
							const data = e.data as { gameOver?: boolean } | null;
							save = data && !data.gameOver ? " 💾" : "";
							break;
						}
					}
				}
				const name = getGameName(g.meta.id, lang);
				const desc = getGameDesc(g.meta.id, lang);
				return `  ${name.padEnd(15)} ${desc.padEnd(20)} (${g.meta.source})${save}`;
			});
			ctx.ui.notify(
				`Available games:\n${lines.join("\n") || "  (no games loaded)"}`,
				"info",
			);
		},
	});
}
