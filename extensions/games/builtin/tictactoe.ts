/**
 * Tic-Tac-Toe - Classic 3x3 grid against the agent.
 *
 * This game has agent interaction features:
 * - Registers tools "arcade_ttt" and "arcade_ttt_see"
 * - Has message renderers for move/gameover events
 * - Has a before_agent_start hook for system prompt injection
 */

import type {
	ExtensionCommandContext,
	ExtensionContext,
	Theme,
	ToolExecutionMode,
} from "@earendil-works/pi-coding-agent";
import {
	type Component,
	matchesKey,
	Text,
	visibleWidth,
} from "@earendil-works/pi-tui";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import type { GameModule } from "../types.js";
import { type Lang, getLang, gui } from "../i18n.js";
import {
	BOLD,
	DIM,
	BLUE,
	BOLD_GREEN,
	BOLD_YELLOW,
	BOLD_BLUE,
	centerPad,
	delay,
} from "../ansi.js";

const RESET = "\x1b[0m";
type _Component = Component;

// ═══════════════════════════════════════════════════════════════════════════
// Game types & constants
// ═══════════════════════════════════════════════════════════════════════════

type Cell = " " | "X" | "O";
type GameStatus = "playing" | "win_X" | "win_O" | "draw";

interface GameState {
	board: Cell[][];
	userCursorRow: number;
	userCursorCol: number;
	agentCursorRow: number;
	agentCursorCol: number;
	status: GameStatus;
	currentTurn: Cell;
}

const AGENT_CURSOR_HOME_ROW = 0;
const AGENT_CURSOR_HOME_COL = 0;
const CELL_WIDTH = 7;
const CELL_HEIGHT = 3;

function createInitialState(): GameState {
	return {
		board: [
			[" ", " ", " "],
			[" ", " ", " "],
			[" ", " ", " "],
		],
		userCursorRow: 1,
		userCursorCol: 1,
		agentCursorRow: AGENT_CURSOR_HOME_ROW,
		agentCursorCol: AGENT_CURSOR_HOME_COL,
		status: "playing",
		currentTurn: "X",
	};
}

function getWinLine(board: Cell[][]): [number, number][] | null {
	const lines: [number, number][][] = [
		[
			[0, 0],
			[0, 1],
			[0, 2],
		],
		[
			[1, 0],
			[1, 1],
			[1, 2],
		],
		[
			[2, 0],
			[2, 1],
			[2, 2],
		],
		[
			[0, 0],
			[1, 0],
			[2, 0],
		],
		[
			[0, 1],
			[1, 1],
			[2, 1],
		],
		[
			[0, 2],
			[1, 2],
			[2, 2],
		],
		[
			[0, 0],
			[1, 1],
			[2, 2],
		],
		[
			[0, 2],
			[1, 1],
			[2, 0],
		],
	];
	for (const line of lines) {
		const vals = line.map(([r, c]) => board[r][c]);
		if (vals[0] !== " " && vals[0] === vals[1] && vals[1] === vals[2])
			return line;
	}
	return null;
}

function checkWin(board: Cell[][]): GameStatus {
	const winLine = getWinLine(board);
	if (winLine) {
		const [r, c] = winLine[0];
		return board[r][c] === "X" ? "win_X" : "win_O";
	}
	if (board.every((row) => row.every((c) => c !== " "))) return "draw";
	return "playing";
}

function boardToAscii(board: Cell[][], acRow: number, acCol: number): string {
	return board
		.map((row, r) =>
			row
				.map((c, ci) => {
					const on = r === acRow && ci === acCol;
					if (c === " ") return on ? `<[${r},${ci}]>` : ` [${r},${ci}] `;
					return on ? `   <${c}>   ` : `    ${c}    `;
				})
				.join("|"),
		)
		.join("\n---------+---------+---------\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// Board rendering (for both in-game and message renderers)
// ═══════════════════════════════════════════════════════════════════════════

function renderBoard(
	board: Cell[][],
	maxWidth: number,
	cursor?: { row: number; col: number; owner: "user" | "agent" },
): string[] {
	const showCursor = !!cursor;
	const cr = cursor?.row ?? -1,
		cc = cursor?.col ?? -1;
	const cursorSgr = cursor?.owner === "agent" ? "\x1b[33;1m" : "\x1b[32;1m";
	const winLine = getWinLine(board);
	const winCells = new Set((winLine ?? []).map(([r, c]) => `${r},${c}`));
	const cellAt = (r: number, c: number) => ({
		cell: board[r][c],
		isWin: winCells.has(`${r},${c}`),
	});

	const isCursorCorner = (gR: number, gC: number) =>
		showCursor && (gR === cr || gR === cr + 1) && (gC === cc || gC === cc + 1);
	const isCursorHSeg = (gR: number, c: number) =>
		showCursor && c === cc && (gR === cr || gR === cr + 1);
	const isCursorVBorder = (r: number, gC: number) =>
		showCursor && r === cr && (gC === cc || gC === cc + 1);

	const paint = (ch: string, hl: boolean, fg?: string) => {
		if (hl) return `${cursorSgr}${ch}${RESET}`;
		if (fg) return `\x1b[${fg};1m${ch}${RESET}`;
		return DIM(ch);
	};
	const cornerChar = (gR: number, gC: number) => {
		if (gR === 0 && gC === 0) return "┌";
		if (gR === 0 && gC === 3) return "┐";
		if (gR === 3 && gC === 0) return "└";
		if (gR === 3 && gC === 3) return "┘";
		if (gR === 0) return "┬";
		if (gR === 3) return "┴";
		if (gC === 0) return "├";
		if (gC === 3) return "┤";
		return "┼";
	};
	const cornerAdj = (gR: number, gC: number) => {
		const out: { cell: Cell; isWin: boolean }[] = [];
		for (const [dr, dc] of [
			[-1, -1],
			[-1, 0],
			[0, -1],
			[0, 0],
		]) {
			const r = gR + dr,
				c = gC + dc;
			if (r >= 0 && r < 3 && c >= 0 && c < 3) out.push(cellAt(r, c));
		}
		return out;
	};
	const borderFg = (
		adj: { cell: Cell; isWin: boolean }[],
	): string | undefined => {
		const fgs: (string | undefined)[] = adj.map((a) => {
			if (a.cell === " ") return undefined;
			return a.isWin ? "32" : a.cell === "X" ? "34" : "33";
		});
		if (fgs.length === 0) return undefined;
		return fgs.every((f) => f === fgs[0]) ? fgs[0] : undefined;
	};
	const buildContent = (mark: Cell, lineIdx: number, isWin: boolean) => {
		if (mark === " ") return " ".repeat(CELL_WIDTH);
		if (lineIdx !== 1) return " ".repeat(CELL_WIDTH);
		const glyph = mark === "X" ? "╳" : "◯";
		const fg = isWin ? "32" : mark === "X" ? "34" : "33";
		const padLen = CELL_WIDTH - visibleWidth(glyph);
		const left = Math.floor(padLen / 2);
		return `${" ".repeat(left)}\x1b[${fg};1m${glyph}${RESET}${" ".repeat(padLen - left)}`;
	};

	const lines: string[] = [];
	for (let gR = 0; gR <= 3; gR++) {
		let row = "";
		for (let gC = 0; gC <= 3; gC++) {
			row += paint(
				cornerChar(gR, gC),
				isCursorCorner(gR, gC),
				borderFg(cornerAdj(gR, gC)),
			);
			if (gC < 3) {
				const adj: { cell: Cell; isWin: boolean }[] = [];
				if (gR > 0) adj.push(cellAt(gR - 1, gC));
				if (gR < 3) adj.push(cellAt(gR, gC));
				row += paint(
					"─".repeat(CELL_WIDTH),
					isCursorHSeg(gR, gC),
					borderFg(adj),
				);
			}
		}
		lines.push(centerPad(row, maxWidth));
		if (gR === 3) break;
		for (let li = 0; li < CELL_HEIGHT; li++) {
			let cr2 = "";
			for (let gC = 0; gC <= 3; gC++) {
				const adj: { cell: Cell; isWin: boolean }[] = [];
				if (gC > 0) adj.push(cellAt(gR, gC - 1));
				if (gC < 3) adj.push(cellAt(gR, gC));
				cr2 += paint("│", isCursorVBorder(gR, gC), borderFg(adj));
				if (gC < 3)
					cr2 += buildContent(board[gR][gC], li, winCells.has(`${gR},${gC}`));
			}
			lines.push(centerPad(cr2, maxWidth));
		}
	}
	return lines;
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared types
// ═══════════════════════════════════════════════════════════════════════════

export interface BoardDetails {
	board: Cell[][];
	agentCursorRow: number;
	agentCursorCol: number;
	status: GameStatus;
	currentTurn: Cell;
}

function getDetails(state: GameState): BoardDetails {
	return {
		board: state.board.map((r) => [...r]),
		agentCursorRow: state.agentCursorRow,
		agentCursorCol: state.agentCursorCol,
		status: state.status,
		currentTurn: state.currentTurn,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// In-game TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class TicTacToeComponent implements _Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;
	constructor(
		private tui: { requestRender: () => void },
		private state: GameState,
		private onClose: () => void,
		private onUserPlay: (row: number, col: number) => void,
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
		if (this.state.status !== "playing") {
			if (data === "r") this.onClose();
			return true;
		}
		if (this.state.currentTurn !== "X") return true;
		if (matchesKey(data, "up") && this.state.userCursorRow > 0) {
			this.state.userCursorRow--;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "down") && this.state.userCursorRow < 2) {
			this.state.userCursorRow++;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "left") && this.state.userCursorCol > 0) {
			this.state.userCursorCol--;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "right") && this.state.userCursorCol < 2) {
			this.state.userCursorCol++;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "return") || data === " ") {
			const { userCursorRow: r, userCursorCol: c } = this.state;
			if (this.state.board[r][c] === " ") this.onUserPlay(r, c);
		}
		return true;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		const lines: string[] = [];
		const titleText = " Tic-Tac-Toe ";
		const titleLen = visibleWidth(titleText);
		const borderLen = Math.max(0, width - titleLen);
		lines.push(
			DIM("─".repeat(Math.floor(borderLen / 2))) +
				BOLD_BLUE(titleText) +
				DIM("─".repeat(borderLen - Math.floor(borderLen / 2))),
		);
		lines.push("");
		if (this.state.status !== "playing") {
			const t =
				this.state.status === "draw"
					? BOLD_YELLOW(gui("draw", this.lang))
					: this.state.status === "win_X"
						? BOLD_GREEN(`X ${gui("wins", this.lang)}`)
						: BOLD_YELLOW(`O ${gui("wins", this.lang)}`);
			lines.push(centerPad(t, width));
		} else if (this.state.currentTurn === "X") {
			lines.push(
				centerPad(
					`${gui("turn", this.lang)}: ${BOLD_BLUE("X")} (${gui("you", this.lang)})  ${DIM("|")}  ${BOLD_YELLOW("O")} (${gui("agent", this.lang)})`,
					width,
				),
			);
		} else {
			lines.push(
				centerPad(
					`${BLUE("X")} (${gui("you", this.lang)})  ${DIM("|")}  ${gui("turn", this.lang)}: ${BOLD_YELLOW("O")} (${gui("agent", this.lang)})`,
					width,
				),
			);
		}
		lines.push("", "");
		const cursor =
			this.state.status === "playing"
				? {
						row:
							this.state.currentTurn === "X"
								? this.state.userCursorRow
								: this.state.agentCursorRow,
						col:
							this.state.currentTurn === "X"
								? this.state.userCursorCol
								: this.state.agentCursorCol,
						owner:
							this.state.currentTurn === "X"
								? ("user" as const)
								: ("agent" as const),
					}
				: undefined;
		lines.push(...renderBoard(this.state.board, width, cursor));
		lines.push("", "");
		let footer: string;
		if (this.state.status !== "playing")
			footer = `${BOLD("R")} ${gui("restartAction", this.lang)}  ${DIM("|")}  ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
		else if (this.state.currentTurn !== "X")
			footer = DIM(gui("thinking", this.lang));
		else
			footer = `${BOLD("←↑↓→")} ${gui("moveAction", this.lang)}  ${DIM("|")}  ${BOLD("ENTER")} ${gui("playAction", this.lang)}  ${DIM("|")}  ${BOLD("ESC")} ${gui("quitAction", this.lang)}`;
		lines.push(centerPad(footer, width));
		lines.push("", DIM("─".repeat(width)));
		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Message renderer components (for chat history)
// ═══════════════════════════════════════════════════════════════════════════

class BannerMsg implements _Component {
	invalidate() {}
	constructor(
		private title: string,
		private details: BoardDetails | undefined,
		private expanded: boolean,
		private theme: Theme,
	) {}
	render(width: number): string[] {
		const dim = (s: string) => this.theme.fg("dim", s);
		const lines: string[] = [];
		const tLen = visibleWidth(this.title);
		const fillLen = Math.max(0, width - tLen - 2);
		lines.push(
			`${dim("─".repeat(Math.floor(fillLen / 2)))} ${this.title} ${dim("─".repeat(fillLen - Math.floor(fillLen / 2)))}`,
		);
		if (this.expanded && this.details) {
			lines.push("");
			lines.push(...renderBoard(this.details.board, width));
		}
		return lines;
	}
}

class GameOverMsg implements _Component {
	invalidate() {}
	constructor(
		private status: GameStatus,
		private details: BoardDetails | undefined,
		private theme: Theme,
		private lang: Lang,
	) {}
	render(width: number): string[] {
		const dim = (s: string) => this.theme.fg("dim", s);
		const bold = (s: string) => this.theme.bold(s);
		const hr = dim("─".repeat(width));
		const lines: string[] = [hr, ""];
		let title: string, sub: string;
		if (this.status === "win_X") {
			title = bold(this.theme.fg("accent", "★ X " + gui("wins", this.lang)));
			sub = gui("youWinSimple", this.lang);
		} else if (this.status === "win_O") {
			title = bold(this.theme.fg("warning", "★ O " + gui("wins", this.lang)));
			sub = gui("aiWins", this.lang);
		} else {
			title = bold(this.theme.fg("muted", gui("draw", this.lang)));
			sub = gui("draw", this.lang);
		}
		for (const l of [title, dim(sub)]) lines.push(centerPad(l, width));
		lines.push("");
		if (this.details) {
			lines.push(...renderBoard(this.details.board, width), "");
		}
		lines.push(hr);
		return lines;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// GameModule export
// ═══════════════════════════════════════════════════════════════════════════

const INTRO = {
	en: `Tic-Tac-Toe - Classic X vs O

Use arrow keys to move cursor, ENTER to place your mark.
Get three in a row to win!`,
	zh: `井字棋 - 经典圈叉棋

用方向键移动光标，ENTER 落子。
横、竖、斜任意方向连成三子即获胜！`,
};

const SAVE_TYPE = "ttt-save";

const gameTicTacToe: GameModule = {
	meta: {
		id: "tictactoe",
		name: "Tic-Tac-Toe",
		description: "Classic X vs O / 井字棋",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const SAVE_TYPE = "ttt-save";
		const MOVE_MSG = "ttt-move";
		const GAMEOVER_MSG = "ttt-gameover";
		let state: GameState = createInitialState();
		let comp: TicTacToeComponent | null = null;
		let active = false;
		let currentLang: Lang = "en";

		function reconstruct(ctx: ExtensionContext) {
			state = createInitialState();
			active = false;
			for (const entry of ctx.sessionManager.getBranch()) {
				if (entry.type !== "message") continue;
				const msg = entry.message;
				if (
					msg.role !== "toolResult" ||
					(msg.toolName !== "arcade_ttt" && msg.toolName !== "arcade_ttt_see")
				)
					continue;
				const d = msg.details as BoardDetails | undefined;
				if (d) {
					state.board = d.board.map((r) => [...r]);
					state.agentCursorRow = d.agentCursorRow;
					state.agentCursorCol = d.agentCursorCol;
					state.status = d.status;
					state.currentTurn = d.currentTurn;
				}
			}
		}

		const emitGameOver = () => {
			const label =
				state.status === "win_X"
					? "Player X (human) wins"
					: state.status === "win_O"
						? "Player O (agent) wins"
						: state.status === "draw"
							? "Draw"
							: "Game over";
			pi.sendMessage({
				customType: GAMEOVER_MSG,
				content: `Game over: ${label}.`,
				display: true,
				details: getDetails(state),
			});
		};

		// ── Message renderers ──────────────────────────────────────────

		pi.registerMessageRenderer(MOVE_MSG, (msg, { expanded }, theme) => {
			const d = msg.details as BoardDetails | undefined;
			const l = currentLang;
			const turn =
				d?.currentTurn === "O"
					? `${theme.fg("warning", theme.bold("O"))} (${gui("agent", l)})`
					: `${theme.fg("accent", theme.bold("X"))} (${gui("you", l)})`;
			return new BannerMsg(
				`${theme.fg("accent", theme.bold(l === "zh" ? "X 已落子" : "Player X played"))} → ${l === "zh" ? "下一步" : "next"}: ${turn}`,
				d,
				expanded,
				theme,
			);
		});

		pi.registerMessageRenderer(GAMEOVER_MSG, (msg, _o, theme) => {
			const d = msg.details as BoardDetails | undefined;
			return new GameOverMsg(
				(d?.status ?? "draw") as GameStatus,
				d,
				theme,
				currentLang,
			);
		});

		// ── Agent hook ─────────────────────────────────────────────────

		pi.on("before_agent_start", async (event) => {
			if (!active) return undefined;
			return {
				systemPrompt:
					event.systemPrompt +
					`

## Tic-Tac-Toe (you are Player O)

A tic-tac-toe game is in progress. You are Player O. Play through the \`arcade_ttt\` tool.
Your cursor is at (${state.agentCursorRow}, ${state.agentCursorCol}). Emit ALL move_* + play calls in ONE response.

### Strategy
1. Win if you can (two O's in a line with empty third).
2. Block X if they can win.
3. Prefer center → corners → edges.
`,
			};
		});

		// ── Command handler ────────────────────────────────────────────

		const tttHandler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Requires interactive mode", "error");
				return;
			}
			const lang = getLang(ctx);
			currentLang = lang;
			reconstruct(ctx);
			if (state.status !== "playing") state = createInitialState();
			active = true;
			pi.setSessionName("Tic-Tac-Toe");
			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				comp = new TicTacToeComponent(
					tui,
					state,
					() => {
						comp = null;
						active = false;
						done(undefined);
					},
					(row, col) => {
						state.board[row][col] = "X";
						state.status = checkWin(state.board);
						if (state.status === "playing") state.currentTurn = "O";
						comp?.updateState(state);
						pi.appendEntry(SAVE_TYPE, getDetails(state));
						if (state.status === "playing") {
							pi.sendMessage(
								{
									customType: MOVE_MSG,
									content: `Player X played at (row=${row}, col=${col}). It is now Player O's turn.\n\nBoard:\n${boardToAscii(state.board, state.agentCursorRow, state.agentCursorCol)}\n\nYour cursor: (${state.agentCursorRow}, ${state.agentCursorCol}). Emit all moves + play in ONE response.`,
									display: true,
									details: getDetails(state),
								},
								{ triggerTurn: true },
							);
						} else {
							emitGameOver();
							active = false;
						}
					},
					lang,
				);
				return comp;
			});
		};

		// ── Agent tools ────────────────────────────────────────────────

		type Action = "move_up" | "move_down" | "move_left" | "move_right" | "play";

		pi.registerTool({
			name: "arcade_ttt",
			label: "Tic-Tac-Toe Move",
			description:
				"Execute ONE tic-tac-toe action as Player O. action: move_up/down/left/right (move cursor) or play (place O). Emit ALL moves + play in ONE response.",
			promptSnippet: "Play a tic-tac-toe move as Player O",
			parameters: Type.Object({
				action: StringEnum([
					"move_up",
					"move_down",
					"move_left",
					"move_right",
					"play",
				] as const),
			}),
			executionMode: "sequential" as ToolExecutionMode,
			async execute(_id, params, _sig, _upd, _ctx) {
				if (params.action !== "play") await delay(200);
				let result: string;
				switch (params.action) {
					case "move_up":
						if (state.agentCursorRow > 0) state.agentCursorRow--;
						result = `Moved up. Cursor: (${state.agentCursorRow},${state.agentCursorCol})`;
						break;
					case "move_down":
						if (state.agentCursorRow < 2) state.agentCursorRow++;
						result = `Moved down. Cursor: (${state.agentCursorRow},${state.agentCursorCol})`;
						break;
					case "move_left":
						if (state.agentCursorCol > 0) state.agentCursorCol--;
						result = `Moved left. Cursor: (${state.agentCursorRow},${state.agentCursorCol})`;
						break;
					case "move_right":
						if (state.agentCursorCol < 2) state.agentCursorCol++;
						result = `Moved right. Cursor: (${state.agentCursorRow},${state.agentCursorCol})`;
						break;
					case "play": {
						if (state.status !== "playing") throw new Error("Game is over.");
						if (state.currentTurn !== "O") throw new Error("Not your turn.");
						const r = state.agentCursorRow,
							c = state.agentCursorCol;
						if (state.board[r][c] !== " ") {
							comp?.updateState(state);
							throw new Error(`Cell (${r},${c}) taken.`);
						}
						state.board[r][c] = "O";
						state.status = checkWin(state.board);
						state.agentCursorRow = AGENT_CURSOR_HOME_ROW;
						state.agentCursorCol = AGENT_CURSOR_HOME_COL;
						if (state.status === "playing") {
							state.currentTurn = "X";
							result = `Placed O at (${r},${c}). Your turn, X!`;
						} else {
							result = `Placed O at (${r},${c}). ${state.status === "win_O" ? "O wins!" : "Draw!"}`;
							active = false;
							emitGameOver();
						}
						break;
					}
				}
				comp?.updateState(state);
				pi.appendEntry(SAVE_TYPE, getDetails(state));
				return {
					content: [{ type: "text", text: result }],
					details: getDetails(state),
				};
			},
			renderCall(args, theme) {
				return new Text(
					theme.fg("toolTitle", theme.bold("arcade_ttt ")) +
						theme.fg("muted", String(args.action ?? "")),
					0,
					0,
				);
			},
			renderResult(result, { expanded }, theme, ctx) {
				const d = result.details as BoardDetails | undefined;
				const pre = ctx?.isError
					? theme.fg("error", "✗ ")
					: theme.fg("success", "✓ ");
				const sum =
					pre +
					theme.fg(
						"muted",
						result.content[0]?.type === "text" ? result.content[0].text : "",
					);
				return expanded && d
					? new BannerMsg(sum, d, true, theme)
					: new Text(sum, 0, 0);
			},
		});

		pi.registerTool({
			name: "arcade_ttt_see",
			label: "See Board",
			description:
				"See the current tic-tac-toe board and your cursor position.",
			promptSnippet: "See the tic-tac-toe board",
			parameters: Type.Object({}),
			async execute() {
				return {
					content: [
						{
							type: "text",
							text: `Board:\n${boardToAscii(state.board, state.agentCursorRow, state.agentCursorCol)}\n\nCursor: (${state.agentCursorRow},${state.agentCursorCol})\nStatus: ${state.status}`,
						},
					],
					details: getDetails(state),
				};
			},
			renderCall(_a, theme) {
				return new Text(
					theme.fg("toolTitle", theme.bold("arcade_ttt_see")),
					0,
					0,
				);
			},
			renderResult(r, { expanded }, theme) {
				const d = r.details as BoardDetails | undefined;
				const sum =
					theme.fg("success", "✓ ") +
					theme.fg(
						"muted",
						`cursor (${d?.agentCursorRow ?? 0},${d?.agentCursorCol ?? 0})`,
					);
				return expanded && d
					? new BannerMsg(sum, d, true, theme)
					: new Text(sum, 0, 0);
			},
		});

		// ── Menu entry ─────────────────────────────────────────────────

		registerMenuEntry(gameTicTacToe.meta, tttHandler, SAVE_TYPE);
	},
};

export default gameTicTacToe;
