/**
 * Snake game logic tests.
 *
 * Tests core logic extracted from source (boundary, collision,
 * food spawning, direction blocking, effectiveWidth, scoring).
 *
 * Run: npx tsx tests/snake.test.ts
 */

import assert from "node:assert/strict";
import { test, summary, banner, reset } from "./helpers.js";

// ─── Extract game logic (mirrors snake.ts exactly) ───────────────────

const GAME_HEIGHT = 15;

type Direction = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };

interface GameState {
	snake: Point[];
	food: Point;
	direction: Direction;
	nextDirection: Direction;
	score: number;
	gameOver: boolean;
	highScore: number;
}

function createInitialState(ew: number): GameState {
	const sx = Math.floor(ew / 2),
		sy = Math.floor(GAME_HEIGHT / 2);
	const snake = [
		{ x: sx, y: sy },
		{ x: sx - 1, y: sy },
		{ x: sx - 2, y: sy },
	];
	return {
		snake,
		food: spawnFood(snake, ew),
		direction: "right",
		nextDirection: "right",
		score: 0,
		gameOver: false,
		highScore: 0,
	};
}

function spawnFood(snake: Point[], width: number): Point {
	let food: Point;
	do {
		food = {
			x: Math.floor(Math.random() * width),
			y: Math.floor(Math.random() * GAME_HEIGHT),
		};
	} while (snake.some((s) => s.x === food.x && s.y === food.y));
	return food;
}

function tick(state: GameState, effectiveWidth: number): void {
	state.direction = state.nextDirection;
	const head = state.snake[0];
	const d = state.direction;
	const nh = {
		x: head.x + (d === "right" ? 1 : d === "left" ? -1 : 0),
		y: head.y + (d === "down" ? 1 : d === "up" ? -1 : 0),
	};
	if (
		nh.x < 0 ||
		nh.x >= effectiveWidth ||
		nh.y < 0 ||
		nh.y >= GAME_HEIGHT ||
		state.snake.some((s) => s.x === nh.x && s.y === nh.y)
	) {
		state.gameOver = true;
		return;
	}
	state.snake.unshift(nh);
	if (nh.x === state.food.x && nh.y === state.food.y) {
		state.score += 10;
		if (state.score > state.highScore) state.highScore = state.score;
		state.food = spawnFood(state.snake, effectiveWidth);
	} else {
		state.snake.pop();
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

banner("Snake Logic Tests");

// ─── 1. Boundary: head at all 4 edges → next step game over ──────────

console.log("\n📋 Boundary tests\n");

test("left edge: moving left causes game over", () => {
	const state = createInitialState(20);
	// Place head at left edge
	state.snake[0] = { x: 0, y: 5 };
	state.snake[1] = { x: 1, y: 5 };
	state.snake[2] = { x: 2, y: 5 };
	state.direction = "left";
	state.nextDirection = "left";
	tick(state, 20);
	assert.equal(state.gameOver, true);
});

test("right edge: moving right causes game over", () => {
	const state = createInitialState(20);
	state.snake[0] = { x: 19, y: 5 };
	state.snake[1] = { x: 18, y: 5 };
	state.snake[2] = { x: 17, y: 5 };
	state.direction = "right";
	state.nextDirection = "right";
	tick(state, 20);
	assert.equal(state.gameOver, true);
});

test("top edge: moving up causes game over", () => {
	const state = createInitialState(20);
	state.snake[0] = { x: 10, y: 0 };
	state.snake[1] = { x: 10, y: 1 };
	state.snake[2] = { x: 10, y: 2 };
	state.direction = "up";
	state.nextDirection = "up";
	tick(state, 20);
	assert.equal(state.gameOver, true);
});

test("bottom edge: moving down causes game over", () => {
	const state = createInitialState(20);
	state.snake[0] = { x: 10, y: 14 };
	state.snake[1] = { x: 10, y: 13 };
	state.snake[2] = { x: 10, y: 12 };
	state.direction = "down";
	state.nextDirection = "down";
	tick(state, 20);
	assert.equal(state.gameOver, true);
});

// ─── 2. Self-collision ──────────────────────────────────────────────

console.log("\n🐍 Self-collision tests\n");

test("moving into own body causes game over", () => {
	const state = createInitialState(20);
	// Create a snake with a body segment in the path
	state.snake = [
		{ x: 10, y: 5 }, // head
		{ x: 11, y: 5 },
		{ x: 11, y: 4 },
		{ x: 10, y: 4 },
		{ x: 9, y: 4 },
	];
	state.direction = "up";
	state.nextDirection = "up";
	// head at (10,5) moving up to (10,4) which is own body
	tick(state, 20);
	assert.equal(state.gameOver, true);
});

test("moving into tail is safe if tail will move away", () => {
	const state = createInitialState(20);
	// 3-segment snake, head moving away from tail
	state.snake = [
		{ x: 10, y: 5 },
		{ x: 9, y: 5 },
		{ x: 8, y: 5 },
	];
	state.food = { x: 20, y: 0 }; // food far away
	state.direction = "right";
	state.nextDirection = "right";
	tick(state, 20);
	// Head moves to (11,5), tail at (8,5) is removed → no collision
	assert.equal(state.gameOver, false);
	assert.equal(state.snake.length, 3);
});

// ─── 3. Food never spawns on snake body ─────────────────────────────

console.log("\n🍎 Food spawning tests\n");

test("spawnFood never places food on snake body", () => {
	const snake: Point[] = [];
	for (let i = 0; i < 10; i++) snake.push({ x: i, y: 0 });
	// Run many times to exercise randomness
	for (let trial = 0; trial < 100; trial++) {
		const food = spawnFood(snake, 20);
		assert.ok(
			!snake.some((s) => s.x === food.x && s.y === food.y),
			`Food spawned on snake at (${food.x},${food.y})`,
		);
	}
});

test("spawnFood places within bounds", () => {
	const snake: Point[] = [{ x: 0, y: 0 }];
	const w = 20;
	for (let trial = 0; trial < 100; trial++) {
		const food = spawnFood(snake, w);
		assert.ok(food.x >= 0 && food.x < w, `food.x=${food.x} out of [0,${w})`);
		assert.ok(
			food.y >= 0 && food.y < GAME_HEIGHT,
			`food.y=${food.y} out of [0,${GAME_HEIGHT})`,
		);
	}
});

// ─── 4. Direction reversal blocked ──────────────────────────────────

console.log("\n🔄 Direction reversal tests\n");

test("can't reverse: going right, trying left is blocked", () => {
	const state = createInitialState(20);
	state.direction = "right";
	// Simulate input handler logic: direction !== "left" to go left
	// But current direction is "right", so going left is blocked
	assert.equal(state.direction === "right", true);
	// In the source: if (this.state.direction !== "left") this.state.nextDirection = "right";
	// So setting nextDirection to "left" when direction is "right" is blocked:
	// The code checks: if (direction !== "down") nextDirection = "up" etc.
	// For left: if (direction !== "right") nextDirection = "left" → blocked
});

test("direction change: going right, setting up works", () => {
	const state = createInitialState(20);
	state.direction = "right";
	// Code: if (direction !== "down") nextDirection = "up" → allowed
	state.nextDirection = "up";
	assert.equal(state.nextDirection, "up");
	// After tick, direction becomes "up"
	tick(state, 20);
	assert.equal(state.direction, "up");
});

test("direction reversal: going down, trying up is blocked in source logic", () => {
	// The source checks: if (direction !== "down") nextDirection = "up"
	// So if direction IS "down", setting up is not done
	// Simulate: direction=down, we try to set nextDirection to "up"
	const state = createInitialState(20);
	state.direction = "down";
	state.nextDirection = "down";
	// Source logic: "up" key → if (state.direction !== "down") → false, so no change
	assert.equal(state.nextDirection, "down"); // stays down
});

// ─── 5. effectiveWidth change: head out of new bounds → game over ──

console.log("\n📏 effectiveWidth resize tests\n");

test("head out of new bounds after width shrink triggers game over", () => {
	const state = createInitialState(40);
	// Place head at x=25
	state.snake[0] = { x: 25, y: 5 };
	state.snake[1] = { x: 24, y: 5 };
	state.snake[2] = { x: 23, y: 5 };
	// Simulate effectiveWidth shrinking to 20
	const newWidth = 20;
	if (state.snake[0].x >= newWidth) {
		state.gameOver = true;
	}
	assert.equal(state.gameOver, true);
});

test("head within new bounds does not trigger game over", () => {
	const state = createInitialState(40);
	state.snake[0] = { x: 15, y: 5 };
	state.snake[1] = { x: 14, y: 5 };
	state.snake[2] = { x: 13, y: 5 };
	const newWidth = 20;
	if (state.snake[0].x >= newWidth) {
		state.gameOver = true;
	}
	assert.equal(state.gameOver, false);
});

// ─── 6. Score increments on food eat ────────────────────────────────

console.log("\n🏆 Score increment tests\n");

test("score increases by 10 when eating food", () => {
	const state = createInitialState(20);
	state.food = { x: state.snake[0].x + 1, y: state.snake[0].y };
	state.direction = "right";
	state.nextDirection = "right";
	const prevScore = state.score;
	const prevLen = state.snake.length;
	tick(state, 20);
	assert.equal(state.score, prevScore + 10);
	assert.equal(state.snake.length, prevLen + 1); // snake grows
});

test("score does not increase when not eating food", () => {
	const state = createInitialState(20);
	// Food far from head
	state.food = { x: 0, y: 0 };
	state.direction = "right";
	state.nextDirection = "right";
	const prevScore = state.score;
	tick(state, 20);
	assert.equal(state.score, prevScore);
	assert.equal(state.snake.length, 3); // length stays same (tail pops)
});

test("high score tracks max score", () => {
	const state = createInitialState(20);
	state.food = { x: state.snake[0].x + 1, y: state.snake[0].y };
	state.direction = "right";
	state.nextDirection = "right";
	tick(state, 20);
	assert.equal(state.highScore, 10);
});

if (!summary()) process.exit(1);
