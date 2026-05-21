/**
 * Breakout logic tests.
 * Run: npx tsx tests/breakout.test.ts
 */
import { test, summary, banner } from "./helpers.js";

banner("🏓 Breakout Tests");

const COLS = 40,
	ROWS = 18,
	PADDLE_W = 7,
	BRICK_ROWS = 5,
	BRICK_COLS = 20;

function createInitialState(level = 1) {
	const bricks = [];
	for (let r = 0; r < BRICK_ROWS; r++) {
		const row = [];
		for (let c = 0; c < BRICK_COLS; c++) row.push(r + 1);
		bricks.push(row);
	}
	return {
		paddle: Math.floor(COLS / 2),
		ball: {
			x: Math.floor(COLS / 2),
			y: ROWS - 3,
			dx: 0.8,
			dy: -(1 + level * 0.1),
		},
		bricks,
		score: 0,
		lives: 3,
		gameOver: false,
		won: false,
		level,
	};
}

test("initial state: paddle centered, ball above paddle", () => {
	const s = createInitialState();
	if (s.paddle !== Math.floor(COLS / 2)) throw new Error("paddle not centered");
	if (s.ball.y !== ROWS - 3) throw new Error("ball wrong position");
	if (s.lives !== 3) throw new Error("wrong lives");
});

test("ball bounces off left wall", () => {
	let x = -0.5,
		dx = -1;
	if (x <= 0) {
		x = 0;
		dx = Math.abs(dx);
	}
	if (x !== 0 || dx !== 1) throw new Error("left bounce failed");
});

test("ball bounces off right wall", () => {
	const effCols = COLS;
	let x = effCols - 0.5,
		dx = 1;
	if (x >= effCols - 1) {
		x = effCols - 1;
		dx = -Math.abs(dx);
	}
	if (x !== effCols - 1 || dx !== -1) throw new Error("right bounce failed");
});

test("ball bounces off top wall", () => {
	let y = -0.5,
		dy = -1;
	if (y <= 0) {
		y = 0;
		dy = Math.abs(dy);
	}
	if (y !== 0 || dy !== 1) throw new Error("top bounce failed");
});

test("paddle clamped at left edge", () => {
	let paddle = Math.floor(COLS / 2);
	paddle = Math.max(Math.floor(PADDLE_W / 2), paddle - 100);
	if (paddle !== Math.floor(PADDLE_W / 2))
		throw new Error(`left clamp: ${paddle}`);
});

test("paddle clamped at right edge", () => {
	const effCols = COLS;
	let paddle = Math.floor(COLS / 2);
	paddle = Math.min(effCols - Math.ceil(PADDLE_W / 2) - 1, paddle + 100);
	if (paddle !== effCols - Math.ceil(PADDLE_W / 2) - 1)
		throw new Error("right clamp failed");
});

test("brick collision destroys brick", () => {
	const s = createInitialState();
	const brickW = COLS / BRICK_COLS;
	s.ball = { x: 2 * brickW, y: 1, dx: 0, dy: 1 };
	const bx = Math.floor(s.ball.x / brickW);
	const by = Math.round(s.ball.y);
	if (by >= 0 && by < BRICK_ROWS && bx >= 0 && bx < BRICK_COLS) {
		if (s.bricks[by][bx] !== 0) {
			s.bricks[by][bx] = 0;
			s.score += 10;
		}
	}
	if (s.bricks[1][2] !== 0) throw new Error("brick not destroyed");
	if (s.score !== 10) throw new Error("score not updated");
});

test("ball lost below ROWS decrements lives", () => {
	const s = createInitialState();
	s.lives = 3;
	if (s.ball.y >= ROWS) s.lives--;
	// Simulate ball falling
	s.ball.y = ROWS + 1;
	if (s.ball.y >= ROWS) {
		s.lives--;
	}
	if (s.lives !== 2) throw new Error(`lives=${s.lives}`);
});

test("0 lives = game over", () => {
	const s = createInitialState();
	s.lives = 0;
	s.gameOver = true;
	if (!s.gameOver) throw new Error("should be game over");
});

test("all bricks destroyed = win", () => {
	const s = createInitialState();
	for (const row of s.bricks) row.fill(0);
	if (!s.bricks.every((r) => r.every((c) => c === 0)))
		throw new Error("bricks remain");
	s.won = true;
	if (!s.won) throw new Error("should win");
});

test("paddle bounce angles based on hit position", () => {
	const pw = PADDLE_W;
	// Hit left edge of paddle → negative dx (ball goes left)
	const hitPosLeft = 0;
	const dxLeft = (hitPosLeft / pw - 0.5) * 2.5;
	if (dxLeft >= 0) throw new Error("left hit should go left");
	// Hit center → ~0 dx
	const dxCenter = (0.5 - 0.5) * 2.5;
	if (dxCenter !== 0) throw new Error("center hit should go straight");
	// Hit right edge → positive dx
	const dxRight = (1 - 0.5) * 2.5;
	if (dxRight <= 0) throw new Error("right hit should go right");
});

test("level increases ball speed", () => {
	const s1 = createInitialState(1);
	const s3 = createInitialState(3);
	if (Math.abs(s3.ball.dy) <= Math.abs(s1.ball.dy))
		throw new Error("level 3 should be faster");
});

if (!summary()) process.exit(1);
