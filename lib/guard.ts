import { open, seal } from "./box.js";
import { db, pipe } from "./db.js";
import { cfgerr } from "./env.js";

const hdrs = {
	"content-type": "application/json",
	"cache-control": "no-store",
	"x-content-type-options": "nosniff",
	"referrer-policy": "no-referrer",
};

const maxbad = 8;
const maxhits = 300;
const window = 120_000;

export const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: hdrs });
export const nope = (s: number, m: string) => json({ ok: false, err: m }, s);

export const ip = (r: Request) =>
	r.headers.get("x-real-ip") ?? r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "idk";

export async function sus(who: string) {
	await pipe([["INCR", `futile:bad:${who}`], ["EXPIRE", `futile:bad:${who}`, 900]]);
}

export async function banned(who: string) {
	return Number((await db<string | null>("GET", `futile:bad:${who}`)) ?? 0) >= maxbad;
}

export async function inbox(r: Request, path: string): Promise<{ b: any } | Response> {
	if (r.method !== "POST") return nope(405, "post only");
	const who = ip(r);
	if (await banned(who)) return nope(429, "chill");
	const raw = await r.text();
	if (raw.length > 65536) return nope(413, "too big");
	let env: any = null;
	try { env = JSON.parse(raw); } catch { env = null; }
	const pkt = open(env, "futile|" + path);
	if (!pkt || typeof pkt.t !== "number") {
		await sus(who);
		return nope(401, "nah");
	}
	if (Math.abs(Date.now() - pkt.t) > window) {
		await sus(who);
		return nope(401, "stale, check ur pc clock");
	}
	const min = Math.floor(Date.now() / 60000);
	const [fresh, hits] = await pipe([
		["SET", `futile:n:${env.n}`, "1", "NX", "EX", 300],
		["INCR", `futile:rl:${who}:${min}`],
		["EXPIRE", `futile:rl:${who}:${min}`, 70],
	]);
	if (fresh !== "OK") {
		await sus(who);
		return nope(401, "replay");
	}
	if (Number(hits) > maxhits) return nope(429, "slow down");
	return { b: pkt.b ?? {} };
}

export const outbox = (d: unknown, path: string) => json(seal({ t: Date.now(), b: d }, "futile|" + path + "|res"));

export function same(a: string, b: string) {
	const x = new TextEncoder().encode(a);
	const y = new TextEncoder().encode(b);
	let diff = x.length ^ y.length;
	for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
	return diff === 0;
}

export function wrap(fn: (r: Request) => Promise<Response>) {
	return async (r: Request) => {
		try {
			return await fn(r);
		} catch (err) {
			console.error(err);
			return err instanceof cfgerr ? nope(500, err.message) : nope(500, "server oops, check vercel logs");
		}
	};
}

export const race = <t>(p: Promise<t>, ms: number) =>
	Promise.race([p, new Promise<"slow">((r) => setTimeout(() => r("slow"), ms))]);
