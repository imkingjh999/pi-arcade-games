/**
 * Shared ANSI helpers for games.
 *
 * Each game can either import from here or define its own.
 * Keeping this centralised avoids repetition.
 */

import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const RESET = "\x1b[0m";

export const BOLD = (s: string) => `\x1b[1m${s}${RESET}`;
export const DIM = (s: string) => `\x1b[2m${s}${RESET}`;
export const RED = (s: string) => `\x1b[31m${s}${RESET}`;
export const GREEN = (s: string) => `\x1b[32m${s}${RESET}`;
export const YELLOW = (s: string) => `\x1b[33m${s}${RESET}`;
export const BLUE = (s: string) => `\x1b[34m${s}${RESET}`;
export const MAGENTA = (s: string) => `\x1b[35m${s}${RESET}`;
export const CYAN = (s: string) => `\x1b[36m${s}${RESET}`;
export const BOLD_GREEN = (s: string) => `\x1b[1;32m${s}${RESET}`;
export const BOLD_RED = (s: string) => `\x1b[1;31m${s}${RESET}`;
export const BOLD_YELLOW = (s: string) => `\x1b[1;33m${s}${RESET}`;
export const BOLD_BLUE = (s: string) => `\x1b[1;34m${s}${RESET}`;
export const BOLD_MAGENTA = (s: string) => `\x1b[1;35m${s}${RESET}`;
export const BOLD_CYAN = (s: string) => `\x1b[1;36m${s}${RESET}`;

export function centerPad(content: string, width: number): string {
	const contentLen = visibleWidth(content);
	if (contentLen >= width) return truncateToWidth(content, width);
	const pad = width - contentLen;
	const left = Math.floor(pad / 2);
	return " ".repeat(left) + content + " ".repeat(pad - left);
}

/** Pad a string to a target *visible* width (CJK-aware). */
export function padEndVisible(s: string, width: number): string {
	const v = visibleWidth(s);
	if (v >= width) return s;
	return s + " ".repeat(width - v);
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
