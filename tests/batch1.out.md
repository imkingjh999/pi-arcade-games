# Batch 1 Test Results — 7 Game Logic Test Files

**Date:** 2026-05-20
**Status:** ✅ ALL 118 TESTS PASSING

## Files Created

| File | Tests | Status |
|------|-------|--------|
| `tests/snake.test.ts` | 16 | ✅ |
| `tests/2048.test.ts` | 20 | ✅ |
| `tests/minesweeper.test.ts` | 12 | ✅ |
| `tests/wordle.test.ts` | 11 | ✅ |
| `tests/hangman.test.ts` | 13 | ✅ |
| `tests/memory.test.ts` | 15 | ✅ |
| `tests/tetris.test.ts` | 31 | ✅ |

## Test Coverage Summary

### snake.test.ts (16 tests)
- **Boundary:** Head at all 4 edges → next step game over (4 tests)
- **Self-collision:** Moving into body → game over; tail safe if it moves away (2 tests)
- **Food spawning:** Never on snake body, always within bounds (2 tests)
- **Direction reversal:** Can't reverse (up when going down, etc.) (3 tests)
- **effectiveWidth resize:** Head out of new bounds → game over (2 tests)
- **Score:** +10 on food eat, no change without food, high score tracking (3 tests)

### 2048.test.ts (20 tests)
- **slide():** [2,0,0,2]→[4,0,0,0], [2,2,2,2]→[4,4,0,0], [4,4,8,8]→[8,16,0,0], zeros, single tile, no merges (7 tests)
- **Right slide:** reverse→slide→reverse works correctly (2 tests)
- **canMove():** Empty cell detected, stuck board detected, adjacent same values, vertical pairs (4 tests)
- **addRandomTile():** Only 2 or 4, exactly one tile, no-op on full board (3 tests)
- **Game over:** Stuck board → canMove=false, no move possible (2 tests)
- **Vertical moves:** Up/down column slide and merge (2 tests)

### minesweeper.test.ts (12 tests)
- **First click safe zone:** No mines in 3×3 around click (corner, center, edge) (3 tests)
- **Number calculation:** Correct adjacent mine count (1 test)
- **Flood fill:** Reveals connected zeros, stops at numbered cells (2 tests)
- **Corner reveal:** No out-of-bounds errors (2 tests)
- **Flag toggle:** hidden→flagged→hidden; flagged cells skip reveal (2 tests)
- **Win/loss detection:** All non-mine cells revealed → win; mine hit → loss (2 tests)

### wordle.test.ts (11 tests)
- **Exact match:** All 5 letters correct (2 tests)
- **No match:** All letters absent (1 test)
- **Duplicate letters:** "eerie" vs "eager" exact handling (1 test)
- **Single letter double guess:** Only first occurrence marked present (2 tests)
- **Second pass removal:** Used letters removed from answer pool (2 tests)
- **Input validation:** 5-letter only, overflow rejected, backspace (3 tests)

### hangman.test.ts (13 tests)
- **Wrong count:** Increments on wrong letter, no increment on correct (3 tests)
- **Game over:** 6 wrong = lost; 5 wrong = not yet (2 tests)
- **Win condition:** All letters guessed = win, with wrongs still win, repeated letters (3 tests)
- **Duplicate guess:** Ignored (not re-added, count unchanged) (2 tests)
- **Case insensitive:** Uppercase accepted and lowercased (3 tests)

### memory.test.ts (15 tests)
- **Card creation:** 16 cards, 8 pairs, shuffle varies, all face-down (4 tests)
- **Matching pair:** Both marked matched, picks reset (2 tests)
- **Mismatched pair:** Both flipped back, picks reset (2 tests)
- **Already flipped:** Can't pick same card twice or matched card (2 tests)
- **Game over:** All pairs matched triggers; partial doesn't (2 tests)
- **Best score:** Set on game over, updates if better, stays if worse (3 tests)

### tetris.test.ts (31 tests)
- **Rotation:** T, I, L, O pieces rotate correctly; 4× rotation returns to original (6 tests)
- **Collision detection:** Out of bounds (left, right, bottom), within bounds, with placed pieces, above board (6 tests)
- **Line clearing:** 1 line, 2 lines, rows shift down, non-full skipped, 4 lines (5 tests)
- **Spawn collision:** Full top → game over; empty board → safe (2 tests)
- **Wall kick:** Left edge, right edge, L-piece, T-piece offset (4 tests)
- **Scoring:** 1→100, 2→300, 3→500, 4→800 (×level); level = lines/10 + 1 (7 tests)
- **placePiece:** Correct type written to board cells (1 test)

## How to Run

```bash
# Individual test
npx tsx tests/snake.test.ts

# All tests
for f in tests/snake.test.ts tests/2048.test.ts tests/minesweeper.test.ts tests/wordle.test.ts tests/hangman.test.ts tests/memory.test.ts tests/tetris.test.ts; do
  npx tsx "$f"
done
```

## Approach

Each test file extracts core logic functions from the game source files and tests them directly, outside the TUI. Since all games export only a `GameModule` default (meta + register), the logic functions are mirrored inline from the source — exactly matching the production code. This follows the same pattern as the existing `sokoban.test.ts`.
