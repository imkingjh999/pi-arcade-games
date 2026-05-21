/**
 * Game 2048 - Self-contained remote game module.
 *
 * This file bundles all dependencies inline so it can be loaded
 * from any URL via /game-install without external file references.
 */
import { matchesKey } from "@earendil-works/pi-tui";
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";

// ─── Inlined ANSI helpers ──────────────────────────────────────────────
const RESET = "\x1b[0m";
const BOLD = (s) => `\x1b[1m${s}${RESET}`;
const DIM = (s) => `\x1b[2m${s}${RESET}`;
const BOLD_RED = (s) => `\x1b[1;31m${s}${RESET}`;
const BOLD_GREEN = (s) => `\x1b[1;32m${s}${RESET}`;
const BOLD_YELLOW = (s) => `\x1b[1;33m${s}${RESET}`;
const BOLD_CYAN = (s) => `\x1b[1;36m${s}${RESET}`;

function centerPad(content, width) {
	const contentLen = visibleWidth(content);
	if (contentLen >= width) return truncateToWidth(content, width);
	const pad = width - contentLen;
	const left = Math.floor(pad / 2);
	return " ".repeat(left) + content + " ".repeat(pad - left);
}

// ─── Game Logic ────────────────────────────────────────────────────────
function createInitialState() {
	const board = Array.from({ length: 4 }, () => Array(4).fill(0));
	addRandomTile(board);
	addRandomTile(board);
	return { board, score: 0, gameOver: false, won: false };
}

function addRandomTile(board) {
	const empty = [];
	for (let r = 0; r < 4; r++)
		for (let c = 0; c < 4; c++) if (board[r][c] === 0) empty.push([r, c]);
	if (empty.length === 0) return;
	const [r, c] = empty[Math.floor(Math.random() * empty.length)];
	board[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function slide(row) {
	const filtered = row.filter((v) => v !== 0);
	const result = [];
	let score = 0;
	let i = 0;
	while (i < filtered.length) {
		if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
			const merged = filtered[i] * 2;
			result.push(merged);
			score += merged;
			i += 2;
		} else {
			result.push(filtered[i]);
			i++;
		}
	}
	while (result.length < 4) result.push(0);
	return { result, score };
}

function move(board, dir) {
	const b = board.map((r) => [...r]);
	let totalScore = 0;
	if (dir === "left" || dir === "right") {
		for (let r = 0; r < 4; r++) {
			const row = b[r].slice();
			if (dir === "right") row.reverse();
			const { result, score } = slide(row);
			if (dir === "right") result.reverse();
			totalScore += score;
			b[r] = result;
		}
	} else {
		for (let c = 0; c < 4; c++) {
			const col = [b[0][c], b[1][c], b[2][c], b[3][c]];
			if (dir === "down") col.reverse();
			const { result, score } = slide(col);
			if (dir === "down") result.reverse();
			totalScore += score;
			for (let r = 0; r < 4; r++) b[r][c] = result[r];
		}
	}
	let moved = false;
	for (let r = 0; r < 4; r++)
		for (let c = 0; c < 4; c++) if (b[r][c] !== board[r][c]) moved = true;
	return { board: b, score: totalScore, moved };
}

function canMove(board) {
	for (let r = 0; r < 4; r++)
		for (let c = 0; c < 4; c++) {
			if (board[r][c] === 0) return true;
			if (c < 3 && board[r][c] === board[r][c + 1]) return true;
			if (r < 3 && board[r][c] === board[r + 1][c]) return true;
		}
	return false;
}

const TILE_COLORS = {
	2: "37;44",
	4: "37;44;1",
	8: "37;41",
	16: "37;41;1",
	32: "37;45",
	64: "37;45;1",
	128: "37;42",
	256: "37;42;1",
	512: "37;43",
	1024: "37;43;1",
	2048: "37;46;1",
};

// ─── TUI Component ────────────────────────────────────────────────────
class G2048Component {
	tui;
	state;
	onClose;
	cachedLines = [];
	cachedWidth = 0;
	version = 0;
	cachedVersion = -1;

	constructor(tui, state, onClose) {
		this.tui = tui;
		this.state = state;
		this.onClose = onClose;
	}

	handleInput(data) {
		if (matchesKey(data, "escape") || data === "q") {
			this.onClose();
			return true;
		}
		if (this.state.gameOver) {
			if (data === "r") this.onClose();
			return true;
		}
		let dir = null;
		if (matchesKey(data, "up") || data === "w") dir = "up";
		else if (matchesKey(data, "down") || data === "s") dir = "down";
		else if (matchesKey(data, "left") || data === "a") dir = "left";
		else if (matchesKey(data, "right") || data === "d") dir = "right";
		if (dir) {
			const result = move(this.state.board, dir);
			if (result.moved) {
				this.state.board = result.board;
				this.state.score += result.score;
				addRandomTile(this.state.board);
				if (!canMove(this.state.board)) this.state.gameOver = true;
				if (
					this.state.board.some((r) => r.some((v) => v >= 2048)) &&
					!this.state.won
				)
					this.state.won = true;
				this.version++;
				this.tui.requestRender();
			}
		}
		return true;
	}

	render(width) {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const s = this.state;
		const lines = [];
		const cellW = 6;

		lines.push(
			centerPad(
				`${BOLD_CYAN("2048")} ${DIM("│")} Score: ${BOLD_YELLOW(String(s.score))}`,
				width,
			),
		);
		lines.push("");

		// Top border
		let top = "╭";
		for (let c = 0; c < 4; c++) {
			top += "─".repeat(cellW);
			if (c < 3) top += "┬";
		}
		top += "╮";
		lines.push(centerPad(top, width));

		for (let r = 0; r < 4; r++) {
			let row = "│";
			for (let c = 0; c < 4; c++) {
				const v = s.board[r][c];
				if (v === 0) {
					row += DIM("  ·   ") + "│";
				} else {
					const clr = TILE_COLORS[v] || "37;46;1";
					const text = String(v);
					const pad = cellW - text.length;
					const left = Math.floor(pad / 2);
					row += `\x1b[${clr}m${" ".repeat(left)}${text}${" ".repeat(pad - left)}\x1b[0m│`;
				}
			}
			lines.push(centerPad(row, width));
			if (r < 3) {
				let sep = "├";
				for (let c = 0; c < 4; c++) {
					sep += "─".repeat(cellW);
					if (c < 3) sep += "┼";
				}
				sep += "┤";
				lines.push(centerPad(sep, width));
			}
		}

		let bot = "╰";
		for (let c = 0; c < 4; c++) {
			bot += "─".repeat(cellW);
			if (c < 3) bot += "┴";
		}
		bot += "╯";
		lines.push(centerPad(bot, width));
		lines.push("");

		let footer;
		if (s.gameOver)
			footer = `${BOLD_RED("GAME OVER!")} Score: ${BOLD(String(s.score))}  ${BOLD("R")} restart`;
		else if (s.won)
			footer = `${BOLD_GREEN("YOU WIN! 🎉")} Keep going?  ${BOLD("R")} restart  ${BOLD("Q")} quit`;
		else footer = `${BOLD("←↑↓→")}/WASD slide  ${DIM("|")}  ${BOLD("Q")} quit`;
		lines.push(centerPad(footer, width));
		lines.push("", DIM("─".repeat(width)));

		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}
}

// ─── GameModule Export ─────────────────────────────────────────────────
const SAVE_TYPE = "game-2048-save";

const game2048 = {
	meta: {
		id: "2048",
		name: "2048",
		description: "Slide & merge tiles (remote)",
		source: "remote",
	},
	saveType: SAVE_TYPE,
	register(pi, registerMenuEntry) {
		const handler = async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("2048 requires interactive mode", "error");
				return;
			}
			// Try to restore saved state
			const entries = ctx.sessionManager.getEntries();
			let state;
			for (let i = entries.length - 1; i >= 0; i--) {
				const e = entries[i];
				if (e.type === "custom" && e.customType === SAVE_TYPE) {
					const saved = e.data;
					if (saved && !saved.gameOver) state = saved;
					break;
				}
			}
			if (!state) state = createInitialState();
			await ctx.ui.custom((tui, _t, _kb, done) => {
				const comp = new G2048Component(tui, state, () => {
					pi.appendEntry(SAVE_TYPE, state);
					done(undefined);
				});
				return comp;
			});
		};
		registerMenuEntry(game2048.meta, handler, SAVE_TYPE);
	},
};

export default game2048;
