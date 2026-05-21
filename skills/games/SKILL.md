---
description: Retro terminal arcade - play Snake, 2048, Minesweeper, Wordle, Hangman, Tic-Tac-Toe, Gomoku, Tetris, Breakout, Memory, Sudoku, Connect Four, Reversi, Sliding Puzzle, Battleship, Pong, Lights Out, and Typing Test directly in your terminal.
---

# Pi Arcade / 街机游戏

Open the retro terminal arcade with `/arcade`. All games auto-save on exit — re-open `/arcade` to continue where you left off.

用 `/arcade` 打开街机游戏菜单。所有游戏退出时自动存档——再次打开 `/arcade` 即可继续。

| Command                 | Description / 说明                                 |
| ----------------------- | -------------------------------------------------- |
| `/arcade`               | Open game selection menu / 打开游戏选择菜单        |
| `/arcade-list`          | List all games (shows 💾 for saves) / 列出所有游戏 |
| `/arcade-install <url>` | Install a game from a URL / 从URL安装游戏          |

## Controls / 操作

All games support / 所有游戏支持:

- Arrow keys for navigation/movement / 方向键导航/移动
- `ESC` / `Q` to quit (progress auto-saved) / 退出（自动存档）
- `R` to restart after game over / 游戏结束后重新开始

## Tips / 提示

- Background long-running tasks with **Ctrl+B** before starting a game / 玩游戏前用 Ctrl+B 把后台任务挂起
- Games with 💾 badge have saved progress — select to continue / 带 💾 标记的游戏有存档，选择即可继续
- After quitting a game, you return to the arcade menu / 退出游戏后返回街机菜单

### Game Controls / 游戏操作

| Game               | Controls / 操作                                                                        |
| ------------------ | -------------------------------------------------------------------------------------- |
| **2048**           | Arrow keys to slide & merge tiles / 方向键滑动合并数字                                 |
| **Minesweeper**    | `F` to flag/unflag, `ENTER` to reveal / `F` 标旗，`ENTER` 翻开                         |
| **Wordle**         | Type 5 letters + `ENTER` to submit / 输入5个字母 + `ENTER` 提交                        |
| **Hangman**        | Type any letter to guess / 输入字母猜单词                                              |
| **Snake**          | WASD or arrow keys, `ESC` to pause / WASD 或方向键，`ESC` 暂停                         |
| **Tetris**         | Arrow keys to move/rotate, `SPACE` for hard drop / 方向键移动旋转，`空格` 硬降         |
| **Breakout**       | ←→ to move paddle, break all bricks / 左右移动挡板，打碎所有砖块                       |
| **Gomoku**         | Arrow keys to move cursor, `ENTER` to place stone / 方向键移动，`ENTER` 落子，五子连珠 |
| **Memory**         | Arrow keys + `SPACE` to flip cards, find matching pairs / 方向键+`空格` 翻牌配对       |
| **Tic-Tac-Toe**    | Arrow keys to move cursor, `ENTER` to place ✕ / 方向键移动，`ENTER` 落子，对战AI       |
| **Sudoku**         | Arrow keys to move, `1-9` to fill, `DEL` to clear / 方向键移动，`1-9` 填数，`DEL` 清除 |
| **Connect Four**   | ←→ to select column, `ENTER` to drop disc, vs AI / 左右选列，`ENTER` 落子，对战AI      |
| **Reversi**        | Arrow keys to move, `ENTER` to place, flip pieces / 方向键移动，`ENTER` 落子翻转       |
| **Sliding Puzzle** | Arrow keys to slide tiles into order / 方向键滑块排序 (3×3, 4×4, 5×5)                  |
| **Battleship**     | Arrow keys + `ENTER` to place ships and fire / 方向键+`ENTER` 布舰开火                 |
| **Pong**           | ↑↓ to move paddle, first to 5 wins / 上下移动球拍，先到5分赢                           |
| **Lights Out**     | Arrow keys + `ENTER` to toggle, turn all lights off / 方向键+`ENTER` 切换，关灭所有灯  |
| **Typing Test**    | Just start typing! Tests your WPM and accuracy / 直接打字！测速度和准确率              |
