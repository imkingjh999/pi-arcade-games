/**
 * Loader / httpGet robustness tests.
 *
 * Spins up local HTTP servers to exercise the real httpGet() path via
 * fetchRegistry(): normal fetch, relative-redirect follow, oversized-response
 * rejection, and redirect-depth cap.
 *
 * Run: npx tsx tests/loader.test.ts
 */
import http from "node:http";
import { banner } from "./helpers.js";
import { fetchRegistry } from "../extensions/games/loader.js";

banner("🌐 Loader httpGet robustness tests");

let passed = 0;
let failed = 0;
async function atest(name: string, fn: () => Promise<void>) {
	try {
		await fn();
		passed++;
		console.log(`  ✅ ${name}`);
	} catch (e: any) {
		failed++;
		console.log(`  ❌ ${name}`);
		console.log(`     ${e?.message ?? String(e)}`);
	}
}

function startServer(
	handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ port: number; close: () => Promise<void> }> {
	return new Promise((resolve) => {
		const server = http.createServer(handler);
		server.listen(0, () => {
			const port = (server.address() as any).port;
			resolve({
				port,
				close: () => new Promise((r) => server.close(() => r())),
			});
		});
	});
}

await atest("fetchRegistry parses JSON", async () => {
	const srv = await startServer((_q, res) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				games: [{ id: "t", name: "T", url: "u", description: "d" }],
			}),
		);
	});
	try {
		const m = await fetchRegistry(`http://localhost:${srv.port}`);
		if (!m.games || m.games.length !== 1) throw new Error("expected 1 game");
		if (m.games[0].id !== "t") throw new Error("wrong id");
	} finally {
		await srv.close();
	}
});

await atest("follows relative redirect", async () => {
	const srv = await startServer((req, res) => {
		if (req.url === "/start") {
			res.writeHead(302, { location: "/next" });
			res.end();
			return;
		}
		res.writeHead(200);
		res.end(JSON.stringify({ games: [] }));
	});
	try {
		const m = await fetchRegistry(`http://localhost:${srv.port}/start`);
		if (!Array.isArray(m.games)) throw new Error("expected games array");
	} finally {
		await srv.close();
	}
});

await atest("rejects oversized response (>5MB)", async () => {
	const srv = await startServer((_q, res) => {
		res.writeHead(200);
		res.end("x".repeat(6 * 1024 * 1024));
	});
	try {
		await fetchRegistry(`http://localhost:${srv.port}`);
		throw new Error("should have rejected oversized response");
	} catch (e: any) {
		if (!/exceeded|too large/i.test(e?.message ?? ""))
			throw new Error("wrong error: " + (e?.message ?? e));
	} finally {
		await srv.close();
	}
});

await atest("caps redirect depth (infinite loop)", async () => {
	const srv = await startServer((_req, res) => {
		res.writeHead(302, { location: "/loop" });
		res.end();
	});
	try {
		await fetchRegistry(`http://localhost:${srv.port}/loop`);
		throw new Error("should have rejected redirect loop");
	} catch (e: any) {
		if (!/redirect/i.test(e?.message ?? ""))
			throw new Error("wrong error: " + (e?.message ?? e));
	} finally {
		await srv.close();
	}
});

console.log(`\n════════════════════════════════════════════════════`);
console.log(
	`Total: ${passed + failed} — ${passed} ✅ passed, ${failed} ❌ failed`,
);
if (failed > 0) process.exit(1);
