import { boardcards, type row } from "./cards.js";
import { dc, dcerr, drop, mine, recent, redo, textof, type msg } from "./dc.js";
import { env } from "./env.js";

export type dude = { name: string; dim: string };
export type state = { bid: string; bh: string; did: string };
type entry = { n: string; t: number; on: boolean; d: string };

const stale = 3 * 60_000;
const flake = (s: unknown): s is string => typeof s === "string" && /^\d{15,21}$/.test(s);
const okname = /^[A-Za-z0-9_]{3,16}$/;

function read(m: msg | null): Map<string, entry> {
	const out = new Map<string, entry>();
	if (!m) return out;
	const hit = textof(m).match(/\]\(https?:\/\/[^)\s]*[?&]r=([A-Za-z0-9_-]+)\)/);
	if (!hit) return out;
	try {
		const list = JSON.parse(Buffer.from(hit[1], "base64url").toString("utf8"));
		if (!Array.isArray(list)) return out;
		for (const x of list.slice(0, 200)) {
			if (!Array.isArray(x) || typeof x[0] !== "string" || !okname.test(x[0])) continue;
			out.set(x[0].toLowerCase(), { n: x[0], t: Number(x[1]) * 1000 || 0, on: x[2] === 1, d: typeof x[3] === "string" ? x[3].slice(0, 64) : "" });
		}
	} catch {
		return out;
	}
	return out;
}

const pack = (ros: Map<string, entry>) =>
	Buffer.from(JSON.stringify([...ros.values()].map((e) => [e.n, Math.floor(e.t / 1000), e.on ? 1 : 0, e.d]))).toString("base64url");

async function fetchboard(ch: string, bid: unknown): Promise<msg | null> {
	if (flake(bid)) {
		try {
			const m = await dc<msg>("GET", `/channels/${ch}/messages/${bid}`);
			if (mine(m)) return m;
		} catch (err) {
			if (!(err instanceof dcerr && (err.code === 10008 || err.status === 404))) throw err;
		}
	}
	return (await recent(ch)).find(mine) ?? null;
}

export async function board(ch: string, me: dude | null, up: boolean, bid: unknown, site: string, srv = ""): Promise<state> {
	const rn = Date.now();
	const m = await fetchboard(ch, bid);
	const ros = read(m);
	const before = pack(ros);
	const old = me ? ros.get(me.name.toLowerCase()) : undefined;

	if (me) ros.set(me.name.toLowerCase(), { n: me.name, t: rn, on: up, d: up ? me.dim : "" });
	for (const e of ros.values()) if (e.on && rn - e.t > stale) e.on = false;

	const fresh = old && old.on === up && (old.d === (up ? me?.dim : "")) && rn - old.t < 90_000;
	const shown = [...ros.values()].map((e) => [e.n, e.on, e.on ? e.d : Math.floor(e.t / 60_000)]);
	const prevshown = [...read(m).values()].map((e) => [e.n, e.on, e.on ? e.d : Math.floor(e.t / 60_000)]);
	if (m && fresh && JSON.stringify(shown) === JSON.stringify(prevshown) && before.length) {
		return { bid: m.id, bh: "", did: "same" };
	}

	const rows: row[] = [...ros.values()]
		.map((e) => ({ name: e.n, on: e.on, dim: e.d || undefined, seen: e.on ? 0 : e.t }))
		.sort((a, b) => Number(b.on) - Number(a.on) || (a.on ? 0 : b.seen - a.seen) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
	const link = `https://${site}/?r=${pack(ros)}`;
	const cards = boardcards(rows, srv, env.tz, link);

	if (m) {
		try {
			await redo(ch, m.id, cards);
			return { bid: m.id, bh: "", did: "edited" };
		} catch (err) {
			if (!(err instanceof dcerr && (err.code === 10008 || err.code === 50005 || err.status === 404))) throw err;
		}
	}
	const made = await drop(ch, cards);
	return { bid: made.id, bh: "", did: "posted" };
}
