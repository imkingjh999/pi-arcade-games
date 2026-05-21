/**
 * Internationalization (i18n) module for Pi Arcade.
 *
 * Stores language preference and visited-games set in session entries.
 * Provides translated strings for the arcade menu, game names, and descriptions.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export type Lang = "en" | "zh";

export const PREFS_SAVE_TYPE = "arcade-prefs";

export interface ArcadePrefs {
	lang: Lang;
	visitedGames: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Read / Write preferences
// ═══════════════════════════════════════════════════════════════════════════

export function getPrefs(ctx: ExtensionCommandContext): ArcadePrefs {
	const entries = ctx.sessionManager.getEntries();
	for (let i = entries.length - 1; i >= 0; i--) {
		const e = entries[i];
		if (e.type === "custom" && e.customType === PREFS_SAVE_TYPE) {
			return (e.data as ArcadePrefs) ?? { lang: "en", visitedGames: [] };
		}
	}
	return { lang: "en", visitedGames: [] };
}

export function getLang(ctx: ExtensionCommandContext): Lang {
	return getPrefs(ctx).lang;
}

export function isGameVisited(
	ctx: ExtensionCommandContext,
	gameId: string,
): boolean {
	return getPrefs(ctx).visitedGames.includes(gameId);
}

// Saving prefs requires `pi.appendEntry()` — done by the caller in arcade.ts

// ═══════════════════════════════════════════════════════════════════════════
// Game name & description translations (classic Chinese names)
// ═══════════════════════════════════════════════════════════════════════════

interface GameI18n {
	name: { en: string; zh: string };
	desc: { en: string; zh: string };
}

const GAME_I18N: Record<string, GameI18n> = {
	"2048": {
		name: { en: "2048", zh: "2048" },
		desc: { en: "Slide & merge tiles", zh: "滑动合并数字" },
	},
	battleship: {
		name: { en: "Battleship", zh: "海战棋" },
		desc: { en: "Naval combat vs AI", zh: "对战AI海战棋" },
	},
	breakout: {
		name: { en: "Breakout", zh: "打砖块" },
		desc: { en: "Break bricks with ball", zh: "弹球消砖块" },
	},
	connect4: {
		name: { en: "Connect Four", zh: "四子棋" },
		desc: { en: "Drop discs, get 4 in a row", zh: "落子四连珠" },
	},
	fifteen: {
		name: { en: "Sliding Puzzle", zh: "华容道" },
		desc: { en: "Arrange tiles in order", zh: "滑块排序" },
	},
	hangman: {
		name: { en: "Hangman", zh: "吊死鬼" },
		desc: { en: "Guess the word", zh: "猜单词" },
	},
	lightsout: {
		name: { en: "Lights Out", zh: "关灯" },
		desc: { en: "Toggle all lights off", zh: "关灭所有灯" },
	},
	memory: {
		name: { en: "Memory", zh: "记忆翻牌" },
		desc: { en: "Flip & match pairs", zh: "翻牌配对" },
	},
	minesweeper: {
		name: { en: "Minesweeper", zh: "扫雷" },
		desc: { en: "Clear mines without detonating", zh: "清除地雷别踩雷" },
	},
	pong: {
		name: { en: "Pong", zh: "乒乓" },
		desc: { en: "Classic paddle game", zh: "经典弹球对战" },
	},
	reversi: {
		name: { en: "Reversi", zh: "黑白棋" },
		desc: { en: "Othello strategy game", zh: "翻转棋策略对弈" },
	},
	snake: {
		name: { en: "Snake", zh: "贪吃蛇" },
		desc: { en: "Eat & grow", zh: "吃食成长" },
	},
	sudoku: {
		name: { en: "Sudoku", zh: "数独" },
		desc: { en: "9×9 number puzzle", zh: "九宫格数字推理" },
	},
	tetris: {
		name: { en: "Tetris", zh: "俄罗斯方块" },
		desc: { en: "Stack & clear lines", zh: "堆叠消行" },
	},
	tictactoe: {
		name: { en: "Tic-Tac-Toe", zh: "井字棋" },
		desc: { en: "Classic X vs O", zh: "经典圈叉棋" },
	},
	typing: {
		name: { en: "Typing Test", zh: "打字测试" },
		desc: { en: "Test your typing speed", zh: "测试打字速度" },
	},
	wordle: {
		name: { en: "Wordle", zh: "猜词" },
		desc: { en: "5 letters, 6 tries", zh: "五字母六次猜" },
	},
	gomoku: {
		name: { en: "Gomoku", zh: "五子棋" },
		desc: { en: "Five in a row", zh: "五子连珠" },
	},
};

export function getGameName(id: string, lang: Lang): string {
	return GAME_I18N[id]?.name[lang] ?? id;
}

export function getGameDesc(id: string, lang: Lang): string {
	return GAME_I18N[id]?.desc[lang] ?? "";
}

// ═══════════════════════════════════════════════════════════════════════════
// Menu UI strings
// ═══════════════════════════════════════════════════════════════════════════

export const MENU = {
	// Language selection screen
	langTitle: {
		en: "Select Language / 选择语言",
		zh: "Select Language / 选择语言",
	},
	langEn: { en: "English", zh: "English" },
	langZh: { en: "中文", zh: "中文" },
	langHint: {
		en: "↑↓ select    ENTER confirm",
		zh: "↑↓ 选择      ENTER 确认",
	},

	// Arcade menu header
	// (subtitle removed)

	// Footer hints
	selectHint: {
		en: `${"↑↓"} select`,
		zh: `${"↑↓"} 选择`,
	},
	playHint: { en: "ENTER play", zh: "ENTER 开始" },
	jumpHint: { en: "jump", zh: "跳转" },
	scrollHint: { en: "PgUp/PgDn scroll", zh: "PgUp/PgDn 翻页" },
	quitHint: { en: "ESC quit", zh: "ESC 退出" },
	continueLabel: { en: "Continue:", zh: "继续游戏：" },
	jumpTo: { en: "Jump to #", zh: "跳转到 #" },

	// Game intro screen
	introTitle: { en: "About", zh: "游戏简介" },
	introPressEnter: {
		en: "Press ENTER to start...",
		zh: "按 ENTER 开始游戏...",
	},
	introPressQ: { en: "ESC back to menu", zh: "ESC 返回菜单" },
};

export function t(key: keyof typeof MENU, lang: Lang): string {
	return MENU[key][lang];
}

// ═══════════════════════════════════════════════════════════════════════════
// Common in-game UI strings (shared across all games)
// ═══════════════════════════════════════════════════════════════════════════

export const GAME_UI: Record<string, { en: string; zh: string }> = {
	// Controls
	move: { en: "←↑↓→ move", zh: "←↑↓→ 移动" },
	slide: { en: "←↑↓→/WASD slide", zh: "←↑↓→/WASD 滑动" },
	play: { en: "ENTER play", zh: "ENTER 落子" },
	select: { en: "ENTER select", zh: "ENTER 选择" },
	quit: { en: "ESC quit", zh: "ESC 退出" },
	restart: { en: "R restart", zh: "R 重来" },
	fill: { en: "1-9 fill", zh: "1-9 填写" },
	clear: { en: "DEL clear", zh: "DEL 清除" },
	start: { en: "ENTER start", zh: "ENTER 开始" },
	place: { en: "ENTER place", zh: "ENTER 放置" },
	open: { en: "ENTER open", zh: "ENTER 翻开" },
	flag: { en: "F flag", zh: "F 标旗" },
	chord: { en: "C chord", zh: "C 连开" },

	// Status
	gameOver: { en: "GAME OVER!", zh: "游戏结束！" },
	youWin: { en: "🎉 YOU WIN!", zh: "🎉 你赢了！" },
	youLose: { en: "YOU LOSE", zh: "你输了" },
	draw: { en: "Draw!", zh: "平局！" },
	complete: { en: "🎉 COMPLETE!", zh: "🎉 完成！" },
	thinking: { en: "Agent is thinking...", zh: "AI 思考中..." },
	keepGoing: { en: "Keep going?", zh: "继续挑战？" },

	// Labels
	score: { en: "Score", zh: "得分" },
	best: { en: "Best", zh: "最佳" },
	level: { en: "Level", zh: "等级" },
	moves: { en: "Moves", zh: "步数" },
	time: { en: "Time", zh: "时间" },
	lives: { en: "Lives", zh: "生命" },
	lines: { en: "Lines", zh: "行数" },
	highScore: { en: "High Score", zh: "最高分" },

	// Difficulty
	selectDifficulty: { en: "Select Difficulty", zh: "选择难度" },
	easy: { en: "Easy", zh: "简单" },
	medium: { en: "Medium", zh: "中等" },
	hard: { en: "Hard", zh: "困难" },

	// Roles
	you: { en: "You", zh: "你" },
	agent: { en: "Agent", zh: "AI" },
	turn: { en: "Turn", zh: "回合" },
	turnX: { en: "Turn: X", zh: "回合：X" },
	turnO: { en: "Turn: O", zh: "回合：O" },

	// Specific
	wins: { en: "wins!", zh: "获胜！" },
	newRecord: { en: "New Record!", zh: "新纪录！" },
	misses: { en: "Misses", zh: "错误" },
	words: { en: "Words", zh: "单词" },
	accuracy: { en: "Accuracy", zh: "准确率" },
	wpm: { en: "WPM", zh: "字/分" },
	left: { en: "left", zh: "剩余" },
	guesses: { en: "guesses", zh: "次" },
	letters: { en: "letters", zh: "字母" },
	selectMode: { en: "Select Mode", zh: "选择模式" },
	classic: { en: "Classic", zh: "经典" },
	endless: { en: "Endless", zh: "无尽" },
	pressStart: { en: "Press ENTER to start...", zh: "按 ENTER 开始..." },

	// Control labels (short forms for footers)
	paused: { en: "PAUSED", zh: "暂停" },
	anyKeyContinue: { en: "Any key continue", zh: "按任意键继续" },
	movePaddle: { en: "move paddle", zh: "移动挡板" },
	rotate: { en: "rotate", zh: "旋转" },
	softDrop: { en: "soft", zh: "加速" },
	hardDrop: { en: "drop", zh: "落下" },
	next: { en: "Next:", zh: "下一个:" },
	toggle: { en: "toggle", zh: "切换" },
	flip: { en: "flip", zh: "翻牌" },
	reveal: { en: "reveal", zh: "揭开" },
	fix: { en: "fix", zh: "修正" },
	selectColumn: { en: "select column", zh: "选列" },
	drop: { en: "drop", zh: "落子" },
	aim: { en: "aim", zh: "瞄准" },
	fire: { en: "fire", zh: "开火" },
	slideTiles: { en: "slide tiles", zh: "滑动方块" },
	typeText: { en: "Type the text above", zh: "输入上方文字" },
	startTyping: { en: "Start typing to begin!", zh: "开始打字吧！" },
	typeHere: { en: "Type", zh: "输入" },
	toBegin: { en: "to begin", zh: "开始" },

	// Status labels
	levelClear: { en: "LEVEL CLEAR! 🎉", zh: "关卡通过！🎉" },
	allLightsOut: { en: "🎉 ALL LIGHTS OUT!", zh: "🎉 全部关灯！" },
	solved: { en: "🎉 SOLVED!", zh: "🎉 完成！" },
	boom: { en: "BOOM!", zh: "💥 踩雷了！" },
	brilliant: { en: "BRILLIANT!", zh: "太棒了！" },
	aiWins: { en: "AI wins!", zh: "AI 获胜！" },
	youWinSimple: { en: "You win!", zh: "你赢了！" },
	pleaseWait: { en: "Please wait...", zh: "请稍候..." },
	turnAllOff: { en: "Turn all lights OFF", zh: "关灭所有灯" },
	correctPos: { en: "correct", zh: "正确位置" },
	greenLabel: { en: "green", zh: "绿色" },

	// Game-specific labels
	yourGrid: { en: "Your Grid", zh: "你的网格" },
	enemyGrid: { en: "Enemy Grid", zh: "敌方网格" },
	yourShips: { en: "Your ships", zh: "我方舰船" },
	enemyShips: { en: "Enemy ships", zh: "敌方舰船" },
	placing: { en: "Placing", zh: "放置" },
	fireAtEnemy: { en: "Fire at enemy grid!", zh: "向敌方开火！" },
	hit: { en: "Hit!", zh: "命中！" },
	youSunkAll: { en: "You sunk all ships!", zh: "你击沉了所有敌舰！" },
	miss: { en: "Miss", zh: "未命中" },
	aiSunkFleet: { en: "AI sunk your fleet!", zh: "AI 击沉了你的舰队！" },
	aiHitAt: { en: "AI hit at", zh: "AI 命中" },
	aiMissedAt: { en: "AI missed at", zh: "AI 未命中" },
	placeYour: { en: "Place your", zh: "放置你的" },
	firstTo: { en: "First to", zh: "先得" },
	points: { en: "points", zh: "分" },
	clues: { en: "clues", zh: "条线索" },
	newPuzzle: { en: "new puzzle", zh: "新谜题" },
	newTest: { en: "new test", zh: "新测试" },
	pairs: { en: "Pairs", zh: "配对" },
	playAgain: { en: "play again", zh: "再来" },
	completedIn: { en: "Completed in", zh: "步完成！" },
	gotItIn: { en: "Got it in", zh: "猜中了" },
	wordWas: { en: "Word was", zh: "答案是" },
	guessLabel: { en: "Guess", zh: "猜" },
	typeLetters: { en: "Type 5 letters +", zh: "输入5个字母 +" },
	typeAndFix: { en: "Type the text above", zh: "输入上方文字" },
	with_: { en: "with ", zh: "，" },

	// Action labels (used in footers, replacing .slice() hacks)
	moveAction: { en: "move", zh: "移动" },
	fillAction: { en: "fill", zh: "填写" },
	clearAction: { en: "clear", zh: "清除" },
	quitAction: { en: "quit", zh: "退出" },
	startAction: { en: "start", zh: "开始" },
	placeAction: { en: "place", zh: "放置" },
	restartAction: { en: "restart", zh: "重来" },
	playAction: { en: "play", zh: "落子" },
	selectAction: { en: "select", zh: "选择" },
	flagAction: { en: "flag", zh: "标旗" },
	movesAction: { en: "moves", zh: "步" },
};

/** Get a common in-game UI string by key and language. Falls back to key. */
export function gui(key: string, lang: Lang): string {
	return GAME_UI[key]?.[lang] ?? key;
}
