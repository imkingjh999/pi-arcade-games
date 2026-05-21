/**
 * Game Module Interface - the contract every game must satisfy.
 *
 * Each game is a separate .ts file that exports a `GameModule` object.
 * The arcade loader discovers games via this interface and registers
 * them with the Pi extension API.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

/** Metadata shown in the arcade menu */
export interface GameMeta {
	/** Unique identifier (e.g. "2048", "snake") */
	id: string;
	/** Display name (e.g. "2048", "Snake") */
	name: string;
	/** Short description for the menu */
	description: string;
	/**
	 * Source of the game.
	 * - "builtin"  → bundled with the package
	 * - "remote"   → fetched from a game registry URL
	 * - "local"    → loaded from a user-specified local path
	 */
	source: "builtin" | "remote" | "local";
}

/**
 * Save state for a game. Stored via `pi.appendEntry()`.
 * Each game defines its own `data` shape.
 */
export interface GameSave {
	/** Unique save type identifier (e.g. "snake-save") */
	customType: string;
	/** Opaque game-specific save data (must be JSON-serializable) */
	data: unknown;
}

/**
 * A game module.
 *
 * Each game file must export an object conforming to this interface.
 * The `register` function receives the Pi ExtensionAPI and a reference
 * to the shared GAMES registry so it can wire up its menu entry.
 *
 * Games can optionally support save/restore by:
 * 1. Setting `saveType` to a unique string (e.g. "snake-save")
 * 2. Calling `pi.appendEntry(saveType, state)` when the player exits
 * 3. Reading saved state from `ctx.sessionManager.getEntries()` on launch
 */
export interface GameIntro {
	en: string;
	zh: string;
}

export interface GameModule {
	meta: GameMeta;

	/**
	 * Unique save type for persistence. Set this to enable continue-game.
	 * The arcade menu checks for existing saves and shows a 💾 badge.
	 */
	saveType?: string;

	/**
	 * Game introduction text, shown on first play.
	 * keyed by language code ("en", "zh").
	 */
	intro?: GameIntro;

	/**
	 * Register the game with Pi.
	 *
	 * @param pi       - The Pi ExtensionAPI
	 * @param registerMenuEntry - Call this to add the game to the arcade menu.
	 *                            Pass your game's command handler.
	 */
	register(
		pi: ExtensionAPI,
		registerMenuEntry: (
			meta: GameMeta,
			handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>,
			saveType?: string,
		) => void,
	): void;
}
