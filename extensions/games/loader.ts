/**
 * Game Loader - discovers and loads game modules from multiple sources.
 *
 * Sources:
 *   1. Builtin: games bundled in ./games/builtin/
 *   2. Remote:  fetched from a game registry URL (e.g. GitHub raw, custom API)
 *   3. Local:   user-specified .js files on disk
 *
 * Remote games are fetched as compiled JavaScript (not TypeScript) and
 * dynamically imported. A future "game compiler" service could accept
 * TypeScript and return compiled JS.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type { GameModule, GameMeta } from "./types.js";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import * as http from "node:http";
import * as https from "node:https";

const BUILTIN_DIR = path.join(__dirname, "builtin");
// Cache remote games under the user's home dir (the package install dir may
// be read-only when installed globally / via npx).
const CACHE_DIR = path.join(os.homedir(), ".pi-arcade", "cache");

/**
 * Load all builtin games from ./games/builtin/*.js
 */
export async function loadBuiltinGames(): Promise<GameModule[]> {
	const games: GameModule[] = [];
	if (!fs.existsSync(BUILTIN_DIR)) return games;

	for (const file of fs.readdirSync(BUILTIN_DIR).sort()) {
		if (!file.endsWith(".js") && !file.endsWith(".ts")) continue;
		if (file.endsWith(".d.ts")) continue;
		try {
			const mod = await import(path.join(BUILTIN_DIR, file));
			const game: GameModule = mod.default ?? mod;
			if (isValidGameModule(game)) {
				game.meta.source = "builtin";
				games.push(game);
			} else {
				console.warn(`[arcade] Skipping invalid builtin game: ${file}`);
			}
		} catch (err) {
			console.warn(`[arcade] Failed to load builtin game ${file}:`, err);
		}
	}
	return games;
}

/**
 * Fetch a remote game from a URL.
 *
 * The URL should point to a compiled JavaScript file that exports a GameModule.
 * Example: https://raw.githubusercontent.com/user/pi-games/main/dist/snake.js
 *
 * The fetched JS is cached locally in .game-cache/ for offline use.
 */
export async function fetchRemoteGame(url: string): Promise<GameModule> {
	if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

	const filename = urlToFilename(url);
	const cachePath = path.join(CACHE_DIR, filename);

	// Fetch from remote (always fresh)
	const code = await httpGet(url);
	fs.writeFileSync(cachePath, code, "utf-8");

	// Use a unique path to bypass Node.js module cache
	const uniquePath = cachePath.replace(/\.js$/, `.${Date.now()}.js`);
	fs.copyFileSync(cachePath, uniquePath);

	let game: GameModule;
	try {
		const mod = await import(uniquePath);
		game = (mod.default ?? mod) as GameModule;
	} finally {
		// Clean up the unique copy (best-effort; ignore errors)
		try {
			fs.unlinkSync(uniquePath);
		} catch {}
	}

	if (!isValidGameModule(game)) {
		throw new Error(`Remote game from ${url} is not a valid GameModule`);
	}
	game.meta.source = "remote";
	return game;
}

/**
 * Load a game from a local file path (already compiled .js).
 */
export async function loadLocalGame(filePath: string): Promise<GameModule> {
	const abs = path.resolve(filePath);
	if (!fs.existsSync(abs)) throw new Error(`Game file not found: ${abs}`);

	const mod = await import(abs);
	const game: GameModule = mod.default ?? mod;
	if (!isValidGameModule(game)) {
		throw new Error(`Local game at ${abs} is not a valid GameModule`);
	}
	game.meta.source = "local";
	return game;
}

/**
 * Load a game from a TypeScript source by compiling it on-the-fly.
 * Uses the project's TypeScript installation.
 */
export async function loadTsGame(tsPath: string): Promise<GameModule> {
	const abs = path.resolve(tsPath);
	if (!fs.existsSync(abs)) throw new Error(`Game TS file not found: ${abs}`);
	if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

	const outJs = path.join(
		CACHE_DIR,
		`${path.basename(abs, ".ts")}-${Date.now()}.js`,
	);

	// Compile with tsc (single file, ES module output)
	execFileSync(
		"npx",
		[
			"tsc",
			"--outDir",
			path.dirname(outJs),
			"--module",
			"commonjs",
			"--target",
			"ES2020",
			"--esModuleInterop",
			"--skipLibCheck",
			abs,
		],
		{ stdio: "pipe" },
	);

	// Rename if tsc preserved the directory structure
	const possibleOut = path.join(
		path.dirname(outJs),
		path.basename(abs, ".ts") + ".js",
	);
	if (fs.existsSync(possibleOut) && !fs.existsSync(outJs)) {
		fs.renameSync(possibleOut, outJs);
	}

	return loadLocalGame(outJs);
}

/**
 * Load a game registry manifest from a URL.
 *
 * The manifest is a JSON file listing available games:
 * ```json
 * {
 *   "games": [
 *     { "id": "tetris", "name": "Tetris", "url": "https://.../tetris.js", "description": "Stack blocks" },
 *     { "id": "breakout", "name": "Breakout", "url": "https://.../breakout.js", "description": "Break bricks" }
 *   ]
 * }
 * ```
 */
export interface RegistryManifest {
	games: Array<{
		id: string;
		name: string;
		url: string;
		description: string;
	}>;
}

export async function fetchRegistry(
	registryUrl: string,
): Promise<RegistryManifest> {
	const raw = await httpGet(registryUrl);
	return JSON.parse(raw);
}

/**
 * Register all discovered game modules with Pi.
 */
export async function loadAndRegisterAll(
	pi: ExtensionAPI,
	registerMenuEntry: (
		meta: GameMeta,
		handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>,
		saveType?: string,
	) => void,
	options?: {
		registryUrl?: string;
		localGames?: string[];
	},
): Promise<GameModule[]> {
	const modules: GameModule[] = [];

	// 1. Builtin games
	const builtins = await loadBuiltinGames();
	for (const game of builtins) {
		game.register(pi, registerMenuEntry);
		modules.push(game);
	}

	// 2. Remote games from registry
	if (options?.registryUrl) {
		try {
			const manifest = await fetchRegistry(options.registryUrl);
			for (const entry of manifest.games) {
				try {
					const game = await fetchRemoteGame(entry.url);
					game.register(pi, registerMenuEntry);
					modules.push(game);
				} catch (err) {
					console.warn(`[arcade] Failed to load remote game ${entry.id}:`, err);
				}
			}
		} catch (err) {
			console.warn(`[arcade] Failed to fetch registry:`, err);
		}
	}

	// 3. Local games
	if (options?.localGames) {
		for (const p of options.localGames) {
			try {
				const game = p.endsWith(".ts")
					? await loadTsGame(p)
					: await loadLocalGame(p);
				game.register(pi, registerMenuEntry);
				modules.push(game);
			} catch (err) {
				console.warn(`[arcade] Failed to load local game ${p}:`, err);
			}
		}
	}

	return modules;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function isValidGameModule(obj: unknown): obj is GameModule {
	const g = obj as GameModule;
	return (
		typeof g === "object" &&
		g !== null &&
		typeof g.meta?.id === "string" &&
		typeof g.meta?.name === "string" &&
		typeof g.meta?.description === "string" &&
		typeof g.register === "function"
	);
}

function urlToFilename(url: string): string {
	const hash = Buffer.from(url).toString("base64url").slice(0, 32);
	const baseName = url.split("/").pop() ?? "game";
	return `${hash}-${baseName}`;
}

const VERSION = "1.0.8"; // keep in sync with package.json
const HTTP_MAX_BYTES = 5 * 1024 * 1024; // 5 MB cap on a single game download
const HTTP_TIMEOUT_MS = 15_000;
const HTTP_MAX_REDIRECTS = 5;

function httpGet(url: string): Promise<string> {
	return httpGetWithRedirect(url, 0);
}

function httpGetWithRedirect(url: string, depth: number): Promise<string> {
	return new Promise((resolve, reject) => {
		let parsed: URL;
		try {
			parsed = new URL(url);
		} catch {
			reject(new Error(`Invalid URL: ${url}`));
			return;
		}
		const lib = parsed.protocol === "http:" ? http : https;
		let settled = false;
		let req: http.ClientRequest;
		const fail = (err: Error) => {
			if (settled) return;
			settled = true;
			reject(err);
			req.destroy();
		};
		req = lib.get(
			url,
			{ headers: { "User-Agent": `pi-arcade-games/${VERSION}` } },
			(res) => {
				// 3xx redirect — resolve a (possibly relative) location, cap depth
				if (
					res.statusCode &&
					res.statusCode >= 300 &&
					res.statusCode < 400 &&
					res.headers.location
				) {
					if (depth >= HTTP_MAX_REDIRECTS) {
						res.resume();
						fail(new Error(`Too many redirects fetching ${url}`));
						return;
					}
					const next = new URL(res.headers.location, url).toString();
					res.resume();
					if (settled) return;
					settled = true;
					httpGetWithRedirect(next, depth + 1)
						.then(resolve)
						.catch(reject);
					return;
				}
				if (res.statusCode !== 200) {
					res.resume();
					fail(new Error(`HTTP ${res.statusCode} fetching ${url}`));
					return;
				}
				let data = "";
				let bytes = 0;
				res.on("data", (chunk: Buffer) => {
					if (settled) return;
					bytes += chunk.length;
					if (bytes > HTTP_MAX_BYTES) {
						fail(
							new Error(
								`Response exceeded ${HTTP_MAX_BYTES} bytes fetching ${url}`,
							),
						);
						return;
					}
					data += chunk;
				});
				res.on("end", () => {
					if (!settled) {
						settled = true;
						resolve(data);
					}
				});
				res.on("error", (err) => fail(err));
			},
		);
		req.setTimeout(HTTP_TIMEOUT_MS, () => {
			fail(new Error(`Request timed out after ${HTTP_TIMEOUT_MS}ms fetching ${url}`));
		});
		req.on("error", () => {
			// Errors are funnelled through fail(); req.destroy() may re-emit,
			// which is swallowed by the `settled` guard.
		});
	});
}
