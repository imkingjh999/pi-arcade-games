/**
 * Save-state helpers shared across all games.
 *
 * These are pure functions with no dependency on the Pi runtime, so they
 * can be unit-tested directly. Games use them when restoring state to:
 *  1. decide whether a stored entry represents a resumable (in-progress) game
 *  2. validate the shape of a restored board before trusting it
 *
 * Keeping this centralised avoids the per-game `as GameState` casts that
 * previously caused crashes on corrupted / version-mismatched saves.
 */

/**
 * Does this stored entry represent a game that can be continued?
 *
 * Games signal completion in different ways:
 *  - `gameOver: boolean`  → explicit flag (2048, snake, tetris, fifteen, …)
 *  - `status: string`     → reversi/connect4/pong ("playing" = resumable)
 *  - `phase: string`      → battleship/typing ("placing"/"playing" = resumable)
 *
 * If the shape is unrecognisable we conservatively return false so the menu
 * never shows a misleading 💾 badge for a save it cannot restore.
 */
export function isResumable(data: unknown): boolean {
	if (data == null || typeof data !== "object") return false;
	const d = data as Record<string, unknown>;

	if (typeof d.gameOver === "boolean") return !d.gameOver;

	if (typeof d.status === "string") {
		return (
			d.status === "playing" ||
			d.status === "countdown" ||
			d.status === "scored"
		);
	}

	if (typeof d.phase === "string") {
		return d.phase === "placing" || d.phase === "playing";
	}

	return false;
}

/**
 * Validate that `data` is a 2-D array with the expected row/column counts.
 * Used to reject corrupted saves before they crash `render()`/`move()`.
 */
export function isValidBoard(
	data: unknown,
	rows: number,
	cols: number,
): boolean {
	if (!Array.isArray(data) || data.length !== rows) return false;
	for (const row of data) {
		if (!Array.isArray(row) || row.length !== cols) return false;
	}
	return true;
}

/**
 * Validate a square board of side `size`.
 */
export function isValidSquareBoard(data: unknown, size: number): boolean {
	return isValidBoard(data, size, size);
}
