import { boardcards, type row } from "./cards.js";
import { dcerr, drop, mine, recent, redo } from "./dc.js";
import { env } from "./env.js";

export type dude = { name: string; dim: string };
export type state = { bid: string; bh: string; did: string };

const hash = (s: string) => {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
	return h.toString(16);
};

const flake = (s: unknown): s is string => typeof s === "string" && /^\d{15,21}$/.test(s);

export async function board(
	ch: string, tm: Map<string, string>, ppl: dude[], seen: Record<string, number>, up: boolean, bid: unknown, bh: unknown, srv = "",
): Promise<state> {
	const all = new Map<string, row>();
	const team = new Set([...tm.values()].map((n) => n.toLowerCase()));
	const add = (name: string, on: boolean, dim?: string) => {
		const k = name.toLowerCase();
		const old = all.get(k);
		if (old && (old.on || !on)) return;
		all.set(k, { name, on, dim: on ? dim || undefined : undefined, seen: seenof(k), team: team.has(k) });
	};
	const lower: Record<string, number> = {};
	for (const [k, v] of Object.entries(seen)) lower[k.toLowerCase()] = Math.max(lower[k.toLowerCase()] ?? 0, v);
	const seenof = (k: string) => lower[k] ?? 0;

	for (const p of ppl) add(p.name, true, p.dim);
	for (const n of Object.keys(seen)) add(n, false);
	for (const n of tm.values()) add(n, false);

	const rows = [...all.values()].sort((a, b) =>
		Number(b.on) - Number(a.on) ||
		Number(b.team) - Number(a.team) ||
		(a.on ? 0 : b.seen - a.seen) ||
		a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

	const h = hash(JSON.stringify({ ch, up, srv, tz: env.tz, rows }));
	let id = flake(bid) ? bid : null;
	if (id && h === bh) return { bid: id, bh: h, did: "same" };

	const cards = boardcards(rows, up, srv, env.tz);
	if (!id) id = (await recent(ch)).find(mine)?.id ?? null;
	if (id) {
		try {
			await redo(ch, id, cards);
			return { bid: id, bh: h, did: "edited" };
		} catch (err) {
			if (!(err instanceof dcerr && (err.code === 10008 || err.code === 50005 || err.status === 404))) throw err;
		}
	}
	const m = await drop(ch, cards);
	return { bid: m.id, bh: h, did: "posted" };
}
