# Contributing to Pi Game 🎮

Thanks for your interest in contributing a game! This guide walks you through everything you need to know.

## Quick Start

1. **Fork** this repository
2. **Create** your game file in `extensions/games/builtin/`
3. **Test** locally with `npm run build && pi install .`
4. **Submit** a Pull Request

---

## Game Module Interface

Every game must export a **`GameModule`** object as its default export. Here's the minimal contract with save/restore support:

```typescript
import type { GameModule } from "../types";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const SAVE_TYPE = "my-game-save";

const myGame: GameModule = {
  meta: {
    id: "my-game", // Unique kebab-case identifier
    name: "My Game", // Display name
    description: "A cool game", // Short description for menu
    source: "builtin",
  },
  saveType: SAVE_TYPE, // Enable continue-game 💾

  register(pi, registerMenuEntry) {
    const handler = async (_args: string, ctx: ExtensionCommandContext) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("My Game requires interactive mode", "error");
        return;
      }

      // Restore saved state if available
      const entries = ctx.sessionManager.getEntries();
      let state: GameState | undefined;
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e.type === "custom" && e.customType === SAVE_TYPE) {
          const saved = e.data as GameState | null;
          if (saved && !saved.gameOver) state = saved;
          break;
        }
      }
      if (!state) state = createInitialState();

      await ctx.ui.custom((tui, _theme, _kb, done) => {
        return new MyGameComponent(tui, state!, () => {
          // Save on exit
          pi.appendEntry(SAVE_TYPE, state!);
          done(undefined);
        });
      });
    };

    // Register in the arcade menu (third arg = saveType for 💾 badge)
    registerMenuEntry(myGame.meta, handler, SAVE_TYPE);
  },
};

export default myGame;
```

### Key Points

- **No `pi.registerCommand()`** — games are only accessible through `/game` menu
- **`saveType`** — set this to enable save/restore; the menu shows 💾 for games with saved progress
- **`pi.appendEntry(SAVE_TYPE, state)`** — call this when the player exits to save state
- **`ctx.sessionManager.getEntries()`** — scan this on launch to restore saved state
- State **must be JSON-serializable** (no `Set`, `Map`, etc. — use arrays instead)

---

## TUI Component

Games are rendered via a **Component** interface from `@earendil-works/pi-tui`:

```typescript
import { type Component, matchesKey } from "@earendil-works/pi-tui";

class MyGameComponent implements Component {
  private cachedLines: string[] = [];
  private cachedWidth = 0;
  private version = 0;
  private cachedVersion = -1;

  handleInput(data: string): boolean {
    // Return true to consume the input, false to bubble up
    if (matchesKey(data, "escape") || data === "q") {
      this.onClose();
      return true;
    }
    if (matchesKey(data, "up")) {
      /* ... */
    }
    if (matchesKey(data, "return")) {
      /* ... */
    }
    // Increment version to trigger re-render
    this.version++;
    this.tui.requestRender();
    return true;
  }

  render(width: number): string[] {
    // Return cached if nothing changed
    if (width === this.cachedWidth && this.cachedVersion === this.version)
      return this.cachedLines;

    const lines: string[] = [];
    // Build your visual output here
    lines.push("Hello, game world!");

    this.cachedLines = lines;
    this.cachedWidth = width;
    this.cachedVersion = this.version;
    return lines;
  }

  invalidate() {
    this.cachedWidth = 0; // Force re-render on terminal resize
  }

  constructor(
    private tui: { requestRender: () => void },
    private onClose: () => void,
  ) {}
}
```

### Key TUI APIs

| API                                                  | Purpose                                    |
| ---------------------------------------------------- | ------------------------------------------ |
| `matchesKey(data, "up")`                             | Check for arrow keys, escape, return, etc. |
| `matchesKey(data, "escape")`                         | Escape key                                 |
| `matchesKey(data, "return")`                         | Enter key                                  |
| `tui.requestRender()`                                | Trigger a re-render after state change     |
| `ctx.ui.custom((tui, theme, kb, done) => component)` | Launch custom TUI                          |
| `done(undefined)`                                    | Exit the custom TUI                        |

---

## ANSI Helpers

Use the shared ANSI styling utilities from `../ansi`:

```typescript
import {
  BOLD,
  DIM,
  RED,
  GREEN,
  YELLOW,
  CYAN,
  BOLD_GREEN,
  BOLD_RED,
  centerPad,
} from "../ansi";

// Usage
BOLD("important"); // Bold text
DIM("subtle"); // Dimmed text
RED("danger"); // Colored text
BOLD_GREEN("success"); // Bold + colored
centerPad("text", 40); // Center-pad to width 40
```

Available: `BOLD`, `DIM`, `RED`, `GREEN`, `YELLOW`, `BLUE`, `MAGENTA`, `CYAN`, `BOLD_GREEN`, `BOLD_RED`, `BOLD_YELLOW`, `BOLD_BLUE`, `BOLD_MAGENTA`, `BOLD_CYAN`, `centerPad`, `padEndVisible`, `delay`

---

## Internationalization (i18n)

The arcade supports English and Chinese menus. To add your game's translated name and description, add an entry to `GAME_I18N` in `extensions/games/i18n.ts`:

```typescript
"my-game": {
  name: { en: "My Game", zh: "我的游戏" },
  desc: { en: "A cool game", zh: "一个很酷的游戏" },
},
```

---

## Save/Restore Pattern

All games should support saving progress. The pattern:

1. **Define** `const SAVE_TYPE = "your-game-save";`
2. **Set** `saveType: SAVE_TYPE` on the GameModule
3. **On launch**: scan `ctx.sessionManager.getEntries()` for the latest save
4. **On exit**: call `pi.appendEntry(SAVE_TYPE, state)` to save
5. **State shape**: must include `gameOver: boolean` (used by the menu to detect active saves)

```typescript
// Save data must be JSON-serializable
interface GameState {
  // ... your game fields ...
  gameOver: boolean; // Required — menu checks this
}
```

⚠️ **No `Set` or `Map`** — these don't serialize to JSON. Use arrays instead.

---

## File Structure

```
extensions/games/
├── types.ts              # GameModule, GameMeta, GameSave interfaces
├── ansi.ts               # Shared ANSI helpers
├── i18n.ts               # Internationalization (en/zh)
├── loader.ts             # Game loader (builtin/remote/local)
├── builtin/
│   ├── 2048.ts
│   ├── battleship.ts
│   ├── breakout.ts
│   ├── connect4.ts
│   ├── fifteen.ts
│   ├── gomoku.ts
│   ├── hangman.ts
│   ├── lightsout.ts
│   ├── memory.ts
│   ├── minesweeper.ts
│   ├── pong.ts
│   ├── reversi.ts
│   ├── snake.ts
│   ├── sudoku.ts
│   ├── tetris.ts
│   ├── tictactoe.ts
│   ├── typing.ts
│   ├── wordle.ts
│   └── your-game.ts      # ← Add yours here!
└── registry.example.json
```

---

## Checklist Before Submitting a PR

- [ ] Game file is in `extensions/games/builtin/your-game.ts`
- [ ] Exports a default `GameModule` object
- [ ] `meta.id` is unique kebab-case (check existing games to avoid conflicts)
- [ ] `meta.name` and `meta.description` are present
- [ ] Registers **only** a menu entry via `registerMenuEntry(meta, handler, SAVE_TYPE)`
- [ ] **No `pi.registerCommand()`** — all games go through `/game`
- [ ] Supports save/restore via `saveType`, `pi.appendEntry()`, and `getEntries()`
- [ ] State includes `gameOver: boolean` and is JSON-serializable (no `Set`/`Map`)
- [ ] Handles `Q` / `ESC` to quit (saves state on exit)
- [ ] Handles `R` to restart after game over
- [ ] Implements `invalidate()` for terminal resize
- [ ] Caches rendered output (check `cachedWidth` / `cachedVersion`) to avoid flickering
- [ ] Checks `ctx.hasUI` before launching the TUI
- [ ] Uses ANSI helpers from `../ansi` for consistent styling
- [ ] Adds i18n entry in `extensions/games/i18n.ts`
- [ ] No external npm dependencies (only use `@earendil-works/pi-*` packages and Node.js built-ins)
- [ ] Compiles cleanly with `npm run build`
- [ ] Game is fun! 🎉

---

## Example: Minimal Working Game

Here's a complete minimal game with save/restore:

```typescript
/**
 * Pong - A minimal game example for Pi Game
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey } from "@earendil-works/pi-tui";
import type { GameModule } from "../types";
import { BOLD, DIM, BOLD_GREEN, BOLD_RED, BOLD_YELLOW } from "../ansi";

type _Component = Component;

interface GameState {
  ballX: number;
  ballY: number;
  ballDX: number;
  ballDY: number;
  paddle: number;
  score: number;
  gameOver: boolean;
}

function createInitialState(): GameState {
  return {
    ballX: 20,
    ballY: 7,
    ballDX: 1,
    ballDY: 1,
    paddle: 6,
    score: 0,
    gameOver: false,
  };
}

class PongComponent implements _Component {
  private cachedLines: string[] = [];
  private cachedWidth = 0;
  private version = 0;
  private cachedVersion = -1;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private tui: { requestRender: () => void },
    private state: GameState,
    private onClose: () => void,
  ) {
    this.startTick();
  }

  private startTick() {
    this.interval = setInterval(() => {
      if (this.state.gameOver) return;
      this.state.ballX += this.state.ballDX;
      this.state.ballY += this.state.ballDY;
      if (this.state.ballY <= 0 || this.state.ballY >= 14)
        this.state.ballDY *= -1;
      if (this.state.ballX >= 39) this.state.ballDX *= -1;
      if (this.state.ballX <= 1) {
        if (
          this.state.ballY >= this.state.paddle &&
          this.state.ballY < this.state.paddle + 3
        ) {
          this.state.ballDX *= -1;
          this.state.score++;
        } else {
          this.state.gameOver = true;
        }
      }
      this.version++;
      this.tui.requestRender();
    }, 100);
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, "escape") || data === "q") {
      this.dispose();
      this.onClose();
      return true;
    }
    if (this.state.gameOver && (data === "r" || data === " ")) {
      Object.assign(this.state, createInitialState());
      this.version++;
      this.tui.requestRender();
      return true;
    }
    if (matchesKey(data, "up") && this.state.paddle > 0) this.state.paddle--;
    if (matchesKey(data, "down") && this.state.paddle < 12) this.state.paddle++;
    this.version++;
    this.tui.requestRender();
    return true;
  }

  invalidate() {
    this.cachedWidth = 0;
  }

  render(width: number): string[] {
    if (width === this.cachedWidth && this.cachedVersion === this.version)
      return this.cachedLines;
    const lines: string[] = [];
    lines.push(
      `  ${BOLD_YELLOW("PONG")}  Score: ${BOLD_GREEN(String(this.state.score))}`,
    );
    lines.push(DIM("  ┌" + "─".repeat(40) + "┐"));
    for (let y = 0; y < 15; y++) {
      let row = "";
      for (let x = 0; x < 40; x++) {
        if (x <= 1 && y >= this.state.paddle && y < this.state.paddle + 3)
          row += "█";
        else if (x === this.state.ballX && y === this.state.ballY) row += "●";
        else row += " ";
      }
      lines.push(DIM("  │") + row + DIM("│"));
    }
    lines.push(DIM("  └" + "─".repeat(40) + "┘"));
    if (this.state.gameOver)
      lines.push(`  ${BOLD_RED("GAME OVER!")} Press ${BOLD("R")} to restart`);
    else lines.push(`  ${DIM("↑↓ move paddle, Q quit")}`);
    this.cachedLines = lines;
    this.cachedWidth = width;
    this.cachedVersion = this.version;
    return lines;
  }

  dispose() {
    if (this.interval) clearInterval(this.interval);
  }
}

const SAVE_TYPE = "pong-save";

const gamePong: GameModule = {
  meta: {
    id: "pong",
    name: "Pong",
    description: "Bounce the ball",
    source: "builtin",
  },
  saveType: SAVE_TYPE,

  register(pi, registerMenuEntry) {
    const handler = async (_args: string, ctx: ExtensionCommandContext) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Pong requires interactive mode", "error");
        return;
      }
      const entries = ctx.sessionManager.getEntries();
      let state: GameState | undefined;
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e.type === "custom" && e.customType === SAVE_TYPE) {
          const saved = e.data as GameState | null;
          if (saved && !saved.gameOver) state = saved;
          break;
        }
      }
      if (!state) state = createInitialState();

      await ctx.ui.custom((tui, _t, _kb, done) => {
        return new PongComponent(tui, state!, () => {
          pi.appendEntry(SAVE_TYPE, state!);
          done(undefined);
        });
      });
    };

    registerMenuEntry(gamePong.meta, handler, SAVE_TYPE);
  },
};

export default gamePong;
```

---

## Building & Testing

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run tests
npm test

# Install into Pi locally for testing
pi install .

# Play your game!
# Type /game in Pi, select your game
```

---

## Style Guide

- **One game per file** in `extensions/games/builtin/`
- Use the same file name as `meta.id` (e.g. `snake.ts` for id `"snake"`)
- Keep games self-contained — all logic in one file
- Use shared ANSI helpers from `../ansi`
- No external dependencies — stick to Node.js built-ins and `@earendil-works/pi-*` packages
- Use Unicode box-drawing characters for borders: `╭ ╮ ╰ ╯ │ ─ ├ ┤`
- Use Unicode block elements for game elements: `██ ▓▓ ░░ ● ◆ ▲`
- Add translations for your game name/description in `i18n.ts`
- Comment your code clearly — others will learn from it!

---

## Ideas for Games

Looking for inspiration? Here are some games that would be great additions:

- **Space Invaders** — Defend earth from aliens
- **Sokoban** — Push-box puzzle
- **Flappy Bird** — Tap to fly through pipes
- **Frogger** — Cross the road without getting hit
- **Chess** — Terminal chess vs agent
- **Tower of Hanoi** — Classic disk-stacking puzzle
- **Simon** — Memory pattern game

---

## License

By contributing, you agree that your code will be licensed under the MIT License.

Thank you for making Pi Game more fun! 🕹️
