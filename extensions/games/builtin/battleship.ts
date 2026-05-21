/**
 * Battleship - Classic naval combat vs AI.
 *
 * Place ships on your grid, then take turns firing at the enemy.
 * Arrow keys + Enter to place and fire.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey } from "@earendil-works/pi-tui";
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

const SIZE = 10;
type CellState = "empty" | "ship" | "hit" | "miss";
type Phase = "placing" | "playing" | "won" | "lost";

interface Ship {
	name: string;
	size: number;
	positions: [number, number][];
}

interface GameState {
	playerBoard: CellState[][];
	aiBoard: CellState[][];
	ships: Ship[];
	currentShipIndex: number;
	placingHorizontal: boolean;
	placingPositions: [number, number][];
	cursorRow: number;
	cursorCol: number;
	phase: Phase;
	aiLastHit: [number, number] | null;
	playerShipsLeft: number;
	aiShipsLeft: number;
	message: string;
}

const SHIP_DEFS = [
	{ name: "Carrier", size: 5 },
	{ name: "Battleship", size: 4 },
	{ name: "Destroyer", size: 3 },
	{ name: "Submarine", size: 3 },
];

function createEmptyBoard(): CellState[][] {
	return Array.from({ length: SIZE }, () =>
		Array<CellState>(SIZE).fill("empty"),
	);
}

function canPlaceShip(
	board: CellState[][],
	row: number,
	col: number,
	size: number,
	horizontal: boolean,
): [number, number][] | null {
	const positions: [number, number][] = [];
	for (let i = 0; i < size; i++) {
		const r = horizontal ? row : row + i;
		const c = horizontal ? col + i : col;
		if (r >= SIZE || c >= SIZE) return null;
		if (board[r][c] !== "empty") return null;
		positions.push([r, c]);
	}
	return positions;
}

function placeShip(board: CellState[][], positions: [number, number][]): void {
	for (const [r, c] of positions) board[r][c] = "ship";
}

function aiPlaceShips(board: CellState[][]): Ship[] {
	const ships: Ship[] = [];
	for (const def of SHIP_DEFS) {
		let placed = false;
		while (!placed) {
			const horizontal = Math.random() < 0.5;
			const row = Math.floor(Math.random() * SIZE);
			const col = Math.floor(Math.random() * SIZE);
			const positions = canPlaceShip(board, row, col, def.size, horizontal);
			if (positions) {
				placeShip(board, positions);
				ships.push({ name: def.name, size: def.size, positions });
				placed = true;
			}
		}
	}
	return ships;
}

function countShipCells(ships: Ship[]): number {
	return ships.reduce((sum, s) => sum + s.size, 0);
}

function aiFire(
	board: CellState[][],
	aiLastHit: [number, number] | null,
): [number, number] {
	// Simple AI: if last hit was successful, target adjacent cells
	if (aiLastHit) {
		const dirs: [number, number][] = [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		];
		const shuffled = dirs.sort(() => Math.random() - 0.5);
		for (const [dr, dc] of shuffled) {
			const nr = aiLastHit[0] + dr;
			const nc = aiLastHit[1] + dc;
			if (
				nr >= 0 &&
				nr < SIZE &&
				nc >= 0 &&
				nc < SIZE &&
				board[nr][nc] === "empty"
			) {
				return [nr, nc];
			}
		}
	}
	// Random target
	const empties: [number, number][] = [];
	for (let r = 0; r < SIZE; r++)
		for (let c = 0; c < SIZE; c++)
			if (board[r][c] === "empty" || board[r][c] === "ship")
				empties.push([r, c]);
	return empties[Math.floor(Math.random() * empties.length)];
}

function createInitialState(): GameState {
	return {
		playerBoard: createEmptyBoard(),
		aiBoard: createEmptyBoard(),
		ships: [],
		currentShipIndex: 0,
		placingHorizontal: true,
		placingPositions: [],
		cursorRow: 4,
		cursorCol: 4,
		phase: "placing",
		aiLastHit: null,
		playerShipsLeft: countShipCells(
			SHIP_DEFS.map((d) => ({ ...d, positions: [] })),
		),
		aiShipsLeft: countShipCells(
			SHIP_DEFS.map((d) => ({ ...d, positions: [] })),
		),
		message: "Place your Carrier",
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// TUI Component
// ═══════════════════════════════════════════════════════════════════════════

class BattleshipComponent implements _Component {
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;

	constructor(
		private tui: { requestRender: () => void },
		private state: GameState,
		private onClose: () => void,
		private lang: Lang,
	) {}

	updateState() {
		this.version++;
		this.tui.requestRender();
	}
	invalidate() {
		this.cachedWidth = 0;
	}

	private updatePlacementPreview() {
		const s = this.state;
		if (s.phase !== "placing") return;
		const def = SHIP_DEFS[s.currentShipIndex];
		s.placingPositions =
			canPlaceShip(
				s.playerBoard,
				s.cursorRow,
				s.cursorCol,
				def.size,
				s.placingHorizontal,
			) ?? [];
	}

	handleInput(data: string): boolean {
		if (matchesKey(data, "escape")) {
			this.onClose();
			return true;
		}
		const s = this.state;

		if (s.phase === "won" || s.phase === "lost") {
			if (data === "r") this.onClose();
			return true;
		}

		// Movement
		if (matchesKey(data, "up") && s.cursorRow > 0) {
			s.cursorRow--;
			this.updatePlacementPreview();
			this.updateState();
		} else if (matchesKey(data, "down") && s.cursorRow < SIZE - 1) {
			s.cursorRow++;
			this.updatePlacementPreview();
			this.updateState();
		} else if (matchesKey(data, "left") && s.cursorCol > 0) {
			s.cursorCol--;
			this.updatePlacementPreview();
			this.updateState();
		} else if (matchesKey(data, "right") && s.cursorCol < SIZE - 1) {
			s.cursorCol++;
			this.updatePlacementPreview();
			this.updateState();
		} else if (data === "r" && s.phase === "placing") {
			// Rotate ship
			s.placingHorizontal = !s.placingHorizontal;
			this.updatePlacementPreview();
			this.updateState();
		} else if (matchesKey(data, "return") || data === " ") {
			if (s.phase === "placing") {
				if (s.placingPositions.length > 0) {
					placeShip(s.playerBoard, s.placingPositions);
					const def = SHIP_DEFS[s.currentShipIndex];
					s.ships.push({
						name: def.name,
						size: def.size,
						positions: [...s.placingPositions],
					});
					s.currentShipIndex++;
					if (s.currentShipIndex >= SHIP_DEFS.length) {
						s.phase = "playing";
						s.message = gui("fireAtEnemy", this.lang);
						// AI places its ships
						aiPlaceShips(s.aiBoard);
					} else {
						s.message = `${gui("placeYour", this.lang)} ${SHIP_DEFS[s.currentShipIndex].name}`;
						this.updatePlacementPreview();
					}
					this.updateState();
				}
			} else if (s.phase === "playing") {
				const r = s.cursorRow;
				const c = s.cursorCol;
				if (s.aiBoard[r][c] === "empty" || s.aiBoard[r][c] === "ship") {
					const wasShip = s.aiBoard[r][c] === "ship";
					s.aiBoard[r][c] = wasShip ? "hit" : "miss";
					if (wasShip) {
						s.aiShipsLeft--;
						s.message = gui("hit", this.lang);
						if (s.aiShipsLeft <= 0) {
							s.phase = "won";
							s.message = gui("youSunkAll", this.lang);
							this.updateState();
							return true;
						}
					} else {
						s.message = gui("miss", this.lang);
					}
					this.updateState();

					// AI fires
					setTimeout(() => {
						const [ar, ac] = aiFire(s.playerBoard, s.aiLastHit);
						const wasHit = s.playerBoard[ar][ac] === "ship";
						s.playerBoard[ar][ac] = wasHit ? "hit" : "miss";
						if (wasHit) {
							s.aiLastHit = [ar, ac];
							s.playerShipsLeft--;
							s.message = `${gui("aiHitAt", this.lang)} ${String.fromCharCode(65 + ac)}${ar + 1}!`;
							if (s.playerShipsLeft <= 0) {
								s.phase = "lost";
								s.message = gui("aiSunkFleet", this.lang);
							}
						} else {
							s.aiLastHit = null;
							s.message = `${gui("aiMissedAt", this.lang)} ${String.fromCharCode(65 + ac)}${ar + 1}`;
						}
						this.updateState();
					}, 300);
				}
			}
		}
		return true;
	}

	private renderBoard(
		board: CellState[][],
		title: string,
		hideShips: boolean,
		preview: Set<string>,
	): string[] {
		const s = this.state;
		const lines: string[] = [];

		// Column labels
		let colLabel = "  ";
		for (let c = 0; c < SIZE; c++)
			colLabel += ` ${String.fromCharCode(65 + c)}`;
		lines.push(centerPad(`${BOLD(title)} ${colLabel}`, this.cachedWidth || 60));

		for (let r = 0; r < SIZE; r++) {
			let row = `${DIM(String(r + 1).padStart(2))} `;
			for (let c = 0; c < SIZE; c++) {
				const v = board[r][c];
				const isCursor = r === s.cursorRow && c === s.cursorCol;
				const isPreview = preview.has(`${r},${c}`);
				const cursor = isCursor ? "\x1b[7m" : "";
				const reset = "\x1b[0m";

				if (isPreview) {
					row += `${BOLD_CYAN(" ◆")}`;
				} else if (v === "empty") {
					row += `${cursor} ·${reset}`;
				} else if (v === "ship") {
					if (hideShips) {
						row += `${cursor} ·${reset}`;
					} else {
						row += `${cursor}${BOLD_CYAN(" ■")}${reset}`;
					}
				} else if (v === "hit") {
					row += `${BOLD_RED(" ✕")}`;
				} else {
					row += `${DIM(" ○")}`;
				}
			}
			lines.push(centerPad(row, this.cachedWidth || 60));
		}
		return lines;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version)
			return this.cachedLines;
		this.cachedWidth = width;
		const s = this.state;
		const lines: string[] = [];

		const titleText = " Battleship ";
		const tLen = titleText.length;
		const bLen = Math.max(0, width - tLen);
		lines.push(
			DIM("─".repeat(Math.floor(bLen / 2))) +
				BOLD_CYAN(titleText) +
				DIM("─".repeat(bLen - Math.floor(bLen / 2))),
		);
		lines.push("");

		lines.push(centerPad(s.message, width));
		lines.push("");

		// Determine which board to show based on phase
		if (s.phase === "placing") {
			const previewSet = new Set(
				s.placingPositions.map(([r, c]) => `${r},${c}`),
			);
			const yourGrid = gui("yourGrid", this.lang);
			lines.push(
				...this.renderBoard(s.playerBoard, yourGrid, false, previewSet),
			);
			lines.push("");
			const def = SHIP_DEFS[s.currentShipIndex];
			const placingLabel = gui("placing", this.lang);
			const rotateLabel = gui("rotate", this.lang);
			lines.push(
				centerPad(
					`${placingLabel}: ${BOLD(def.name)} (${def.size}) ${DIM("|")} ${BOLD("R")} ${rotateLabel}`,
					width,
				),
			);
		} else {
			// Show both grids side info
			const previewSet = new Set<string>();
			const enemyGrid = gui("enemyGrid", this.lang);
			lines.push(...this.renderBoard(s.aiBoard, enemyGrid, true, previewSet));
			lines.push("");
			const yourShipsLabel = gui("yourShips", this.lang);
			const enemyShipsLabel = gui("enemyShips", this.lang);
			lines.push(
				centerPad(
					`${yourShipsLabel}: ${BOLD(String(s.playerShipsLeft))}  ${DIM("|")}  ${enemyShipsLabel}: ${BOLD_RED(String(s.aiShipsLeft))}`,
					width,
				),
			);
		}

		// Footer
		lines.push("");
		let footer: string;
		const placeLabel = gui("placeAction", this.lang);
		const rotateLabel2 = gui("rotate", this.lang);
		const aimLabel = gui("aim", this.lang);
		const fireLabel = gui("fire", this.lang);
		if (s.phase === "won" || s.phase === "lost")
			footer = `${BOLD(gui("restart", this.lang))}  ${DIM("|")}  ${BOLD(gui("quit", this.lang))}`;
		else if (s.phase === "placing")
			footer = `${BOLD(gui("move", this.lang))}  ${DIM("|")}  ${BOLD("R")} ${rotateLabel2}  ${DIM("|")}  ${BOLD("ENTER")} ${placeLabel}  ${DIM("|")}  ${BOLD(gui("quit", this.lang))}`;
		else
			footer = `${BOLD("←↑↓→")} ${aimLabel}  ${DIM("|")}  ${BOLD("ENTER")} ${fireLabel}  ${DIM("|")}  ${BOLD(gui("quit", this.lang))}`;
		lines.push(centerPad(footer, width));
		lines.push("", DIM("─".repeat(width)));

		this.cachedLines = lines;
		this.cachedVersion = this.version;
		return lines;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// GameModule Export
// ═══════════════════════════════════════════════════════════════════════════

const INTRO = {
	en: `Battleship - Naval Strategy

Place your ships on the grid, then fire at enemy coordinates to sink the AI fleet.
Use arrow keys to move cursor, ENTER to fire/select.`,
	zh: `海战棋 - 海军战略游戏

在网格上布置你的舰队，然后向敌方坐标开火以击沉AI舰队。
用方向键移动光标，ENTER 开火/选择。`,
};

const SAVE_TYPE = "battleship-save";

const gameBattleship: GameModule = {
	meta: {
		id: "battleship",
		name: "Battleship",
		description: "Naval combat vs AI / 海战对战AI",
		source: "builtin",
	},
	saveType: SAVE_TYPE,
	intro: INTRO,

	register(pi, registerMenuEntry) {
		const handler = async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Battleship requires interactive mode", "error");
				return;
			}

			const state = createInitialState();

			const lang = getLang(ctx);

			await ctx.ui.custom<void>((tui, _t, _kb, done) => {
				const comp = new BattleshipComponent(
					tui,
					state,
					() => {
						pi.appendEntry(SAVE_TYPE, state);
						done(undefined);
					},
					lang,
				);
				comp["updatePlacementPreview"]();
				return comp;
			});
		};

		registerMenuEntry(gameBattleship.meta, handler, SAVE_TYPE);
	},
};

export default gameBattleship;
