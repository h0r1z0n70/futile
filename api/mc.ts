import { board, type dude } from "../lib/board.js";
import { ggcard, ripcard, type pos } from "../lib/cards.js";
import { drop } from "../lib/dc.js";
import { env } from "../lib/env.js";
import { inbox, outbox, wrap } from "../lib/guard.js";
import { send, type post } from "../lib/hook.js";
import { dupe } from "../lib/mem.js";
import { team, teamok } from "../lib/team.js";

const path = "/api/mc";

const flake = (s: unknown): s is string => typeof s === "string" && /^\d{15,21}$/.test(s);
const nm = (s: unknown) => String(s ?? "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
const tx = (s: unknown, n = 256) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, n);
const dm = (s: unknown) => {
	const v = String(s ?? "");
	return /^[a-z0-9_.-]{1,64}:[a-z0-9_./-]{1,64}$/.test(v) ? v : "";
};
const host = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 64);
const int = (v: unknown, lo = -30_000_000, hi = 30_000_000) => {
	const n = Number(v);
	return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : 0;
};
const fl = (v: unknown, max: number) => {
	const n = Number(v);
	return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
};
const at = (ev: any): pos =>
	ev.x === undefined || ev.x === null ? null : { dim: dm(ev.dim), x: int(ev.x), y: int(ev.y), z: int(ev.z) };
const safe = (s: string) => s.replace(/([\\*_~`|])/g, "\\$1").replace(/^([>#-])/, "\\$1").replace(/@/g, "@\u200b");

const boardy = new Set(["world", "ppl"]);

type ctx = {
	ch: Record<string, string | undefined>;
	srv: string;
	posts: post[];
	getteam: () => Promise<Map<string, string>>;
};

export const POST = wrap(async (r) => {
	const got = await inbox(r, path);
	if (got instanceof Response) return got;
	const b = got.b;

	const ch: Record<string, string | undefined> = {};
	for (const k of ["chat", "deaths", "kills", "active"]) if (flake(b.ch?.[k])) ch[k] = b.ch[k];

	const ppl: dude[] = Array.isArray(b.ppl)
		? b.ppl.slice(0, 300).map((p: any) => ({ name: nm(p?.name), dim: dm(p?.dim) })).filter((p: dude) => p.name)
		: [];
	const seen: Record<string, number> = {};
	if (b.seen && typeof b.seen === "object") {
		for (const [k, v] of Object.entries(b.seen).slice(0, 1000)) {
			const n = nm(k);
			if (n) seen[n] = int(v, 0, 9e15);
		}
	}
	const up = b.up !== false;

	let tm: Map<string, string> | null = null;
	const c: ctx = { ch, srv: host(b.srv), posts: [], getteam: async () => (tm ??= await team()) };

	const evs: any[] = Array.isArray(b.ev) ? b.ev.slice(0, 200) : [];
	const errs: string[] = [];
	for (const ev of evs) {
		try {
			await handle(ev ?? {}, c);
		} catch (err) {
			errs.push(`${tx(ev?.t, 16)}: ${err instanceof Error ? err.message : err}`);
		}
	}

	if (ch.chat && c.posts.length) {
		try {
			await send(ch.chat, c.posts, c.srv);
		} catch (err) {
			errs.push(`chat: ${err instanceof Error ? err.message : err}`);
		}
	}

	let bd = { bid: flake(b.bid) ? b.bid : "", bh: String(b.bh ?? ""), did: "skip" };
	if (ch.active && evs.some((e) => boardy.has(e?.t))) {
		try {
			const site = (r.headers.get("x-forwarded-host") ?? new URL(r.url).host).replace(/[^a-z0-9.:-]/gi, "") || "futile.vercel.app";
			bd = await board(ch.active, ppl[0] ?? null, up, b.bid, site, c.srv);
		} catch (err) {
			errs.push(`board: ${err instanceof Error ? err.message : err}`);
		}
	}
	if (errs.length) console.warn("mc errs", errs);
	return outbox({ ok: !errs.length, n: evs.length, bid: bd.bid, bh: bd.bh, board: bd.did, errs }, path);
});

const isteam = async (c: ctx, name: string) => {
	const tm = await c.getteam();
	if (!teamok) return true;
	return [...tm.values()].some((n) => n.toLowerCase() === name.toLowerCase());
};

async function handle(ev: any, c: ctx) {
	switch (ev.t) {
		case "say": {
			const who = nm(ev.who), msg = tx(ev.msg, 400).trim();
			if (!who || !msg || dupe(`s:${who}:${msg}`, 8_000)) return;
			c.posts.push({ who, text: safe(msg) });
			return;
		}
		case "line": {
			const l = tx(ev.txt, 400).trim();
			if (!l || dupe("l:" + l, 8_000)) return;
			c.posts.push({ who: null, text: safe(l) });
			return;
		}
		case "chat": {
			const who = nm(ev.who), msg = tx(ev.msg).trim();
			if (!who || !msg) return;
			c.posts.push({ who, text: safe(msg) });
			return;
		}
		case "rip": {
			const who = nm(ev.who);
			if (!who || !c.ch.deaths) return;
			if (dupe(`rip:${who.toLowerCase()}:${tx(ev.msg, 80)}`, 20_000)) return;
			await drop(c.ch.deaths, [ripcard({ who, msg: tx(ev.msg) || `${who} died`, at: at(ev), total: int(ev.total, 0, 1e9), srv: c.srv })]);
			return;
		}
		case "gg": {
			const by = nm(ev.by), who = nm(ev.who);
			if (!by || !who || !c.ch.kills) return;
			if (dupe(`gg:${by.toLowerCase()}:${who.toLowerCase()}`, 20_000)) return;
			const hp = ev.hp === undefined || ev.hp === null ? null : fl(ev.hp, 2048);
			await drop(c.ch.kills, [ggcard({
				by, who, wep: tx(ev.wep, 64) || "unknown", hp, maxhp: fl(ev.maxhp, 2048) || 20,
				msg: tx(ev.msg) || `${who} was slain by ${by}`, at: at(ev),
				kills: int(ev.kills, 0, 1e9), deaths: int(ev.deaths, 0, 1e9), srv: c.srv,
			})]);
			return;
		}
		case "world": {
			const who = nm(ev.who);
			const where = c.srv || "the world";
			if (who) c.posts.push({ who: null, text: ev.up ? `**${who}** joined ${where}.` : `**${who}** left ${where}.` });
			else c.posts.push({ who: null, text: ev.up ? "The world is open." : "The world is closed." });
			return;
		}
		case "join":
		case "dip":
		case "ppl":
			return;
		default:
			throw new Error("unknown event");
	}
}
