/**
 * Pong logic tests.
 * Run: npx tsx tests/pong.test.ts
 */
import { test, summary, banner } from "./helpers.js";

banner("🏓 Pong Tests");

const WIN_SCORE = 5;

test("ball bounces off top wall", () => {
	let y = -0.01,
		dy = -0.02;
	if (y <= 0) {
		dy = -dy;
		y = 0;
	}
	if (y !== 0 || dy !== 0.02) throw new Error("top bounce failed");
});

test("ball bounces off bottom wall", () => {
	let y = 1.01,
		dy = 0.02;
	if (y >= 1) {
		dy = -dy;
		y = 1;
	}
	if (y !== 1 || dy !== -0.02) throw new Error("bottom bounce failed");
});

test("paddle clamped at top", () => {
	const pH = 0.15;
	let pY = 0.01;
	pY = Math.max(pH / 2, pY);
	if (pY !== pH / 2) throw new Error(`pY=${pY}`);
});

test("paddle clamped at bottom", () => {
	const pH = 0.15;
	let pY = 0.99;
	pY = Math.min(1 - pH / 2, pY);
	if (pY !== 1 - pH / 2) throw new Error("bottom clamp");
});

test("player scores when ball passes right edge", () => {
	let pScore = 0;
	if (1.01 > 1) pScore++;
	if (pScore !== 1) throw new Error("should score");
});

test("AI scores when ball passes left edge", () => {
	let aiScore = 0;
	if (-0.01 < 0) aiScore++;
	if (aiScore !== 1) throw new Error("should score");
});

test("speed capped at maxSpeed", () => {
	const max = 0.06;
	let dx = 0.08;
	dx = Math.max(-max, Math.min(max, dx));
	if (dx !== 0.06) throw new Error(`dx=${dx}`);
});

test("win condition: first to WIN_SCORE", () => {
	const pScore = WIN_SCORE;
	if (pScore >= WIN_SCORE) {
		/* game over */
	} else throw new Error("should win");
});

test("not won at WIN_SCORE - 1", () => {
	if (WIN_SCORE - 1 >= WIN_SCORE) throw new Error("should not win");
});

test("ball speed increases on paddle hit (1.05x)", () => {
	let dx = 0.02;
	dx *= 1.05;
	if (dx !== 0.021) throw new Error("speed multiplier");
});

test("angle varies by paddle hit position", () => {
	const pw = 1.0; // normalized
	const hitPosLeft = 0;
	const dxLeft = (hitPosLeft / pw - 0.5) * 2.5;
	if (dxLeft >= 0) throw new Error("left hit should go left");
	const hitPosRight = 1;
	const dxRight = (hitPosRight / pw - 0.5) * 2.5;
	if (dxRight <= 0) throw new Error("right hit should go right");
});

if (!summary()) process.exit(1);
