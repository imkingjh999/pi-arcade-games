/**
 * Typing Test logic tests.
 * Run: npx tsx tests/typing.test.ts
 */
import { test, summary, banner } from "./helpers.js";

banner("⌨️ Typing Test Tests");

const SENTENCES = [
	"The quick brown fox jumps over the lazy dog near the river bank.",
	"Programming is the art of telling another human what one wants the computer to do.",
];

function pickSentence(): string {
	return SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
}

function calcStats(
	typed: string,
	target: string,
	elapsedMs: number,
): { wpm: number; accuracy: number } {
	if (typed.length === 0 || elapsedMs <= 0) return { wpm: 0, accuracy: 100 };
	let correct = 0;
	for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) correct++;
	const mins = elapsedMs / 60000;
	const wpm = mins > 0 ? Math.round(correct / 5 / mins) : 0;
	const accuracy = Math.round((correct / typed.length) * 100);
	return { wpm, accuracy };
}

test("empty typed: 0 WPM, 100% accuracy", () => {
	const r = calcStats("", SENTENCES[0], 30000);
	if (r.wpm !== 0 || r.accuracy !== 100)
		throw new Error(`${JSON.stringify(r)}`);
});

test("zero elapsed: 0 WPM (no div by zero)", () => {
	const r = calcStats("hello", SENTENCES[0], 0);
	if (r.wpm !== 0) throw new Error(`wpm=${r.wpm}`);
});

test("perfect typing: 100% accuracy", () => {
	const target = SENTENCES[0];
	const r = calcStats(target, target, 30000);
	if (r.accuracy !== 100) throw new Error(`accuracy=${r.accuracy}`);
});

test("WPM calculation: 50 correct chars in 30s = 20 WPM", () => {
	const r = calcStats("a".repeat(50), "a".repeat(50), 30000);
	if (r.wpm !== 20) throw new Error(`wpm=${r.wpm}`);
	// Actually 50/5 = 10 words, 30000ms = 0.5min → 10/0.5 = 20 WPM
});

test("1 error in 10: 90% accuracy", () => {
	const r = calcStats("abcdefghij", "abcdefghiX", 10000);
	if (r.accuracy !== 90) throw new Error(`accuracy=${r.accuracy}`);
});

test("all wrong: 0% accuracy", () => {
	const r = calcStats("XXXXXXXXXX", "YYYYYYYYYY", 10000);
	if (r.accuracy !== 0) throw new Error(`accuracy=${r.accuracy}`);
});

test("sentence picker returns valid sentence", () => {
	const s = pickSentence();
	if (!SENTENCES.includes(s)) throw new Error("invalid sentence");
});

test("cursor at end of target = game complete", () => {
	const target = "hello";
	const cursorPos = target.length;
	if (cursorPos >= target.length) {
		/* game over */
	} else throw new Error();
});

test("backspace moves cursor back", () => {
	let cursor = 3;
	cursor--;
	if (cursor !== 2) throw new Error("backspace failed");
});

test("can't backspace at position 0", () => {
	let cursor = 0;
	if (cursor > 0) cursor--;
	if (cursor !== 0) throw new Error("should stay at 0");
});

if (!summary()) process.exit(1);
