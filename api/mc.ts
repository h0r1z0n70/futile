import { board } from "../lib/board.js";
import { esc, ggcard, ripcard } from "../lib/cards.js";
import { drop, flake, say } from "../lib/dc.js";
import { env } from "../lib/env.js";
import { inbox, outbox, wrap } from "../lib/guard.js";
import * as st from "../lib/store.js";

const path = "/api/mc";

const nm = (s: unknown) => String(s ?? "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
const tx = (s: unknown, n = 256) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, n);
const dm = (s: unknown) => {
	const v = String(s ?? "");
	return /^[a-z0-9_.-]{1,64}:[a-z0-9_./-]{1,64}$/.test(v) ? v : "???";
};
const int = (v: unknown) => {
	const n = Number(v);
	return Number.isFinite(n) ? Math.max(-30_000_000, Math.min(30_000_000, Math.round(n))) : 0;
};
const fl = (v: unknown, max: number) => {
	const n = Number(v);
	return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
};

export const POST = wrap(async (r) => {
	const got = await inbox(r, path);
	if (got instanceof Response) return got;
	const b = got.b;

	await st.savech(b.ch);
	const ch = await st.getch();
	const was = await st.ppl();
	const ppl: st.dude[] = Array.isArray(b.ppl)
		? b.ppl.slice(0, 100).map((p: any) => ({ name: nm(p?.name), dim: dm(p?.dim) })).filter((p: st.dude) => p.name)
		: was;
	await st.setppl(ppl, b.up !== false);

	const evs: any[] = Array.isArray(b.ev) ? b.ev.slice(0, 100) : [];
	const errs: string[] = [];
	for (const ev of evs) {
		try {
			await handle(ev ?? {}, ch, was);
		} catch (err) {
			errs.push(`${tx(ev?.t, 16)}: ${err instanceof Error ? err.message : err}`);
		}
	}

	let bd = "";
	try {
		bd = await board();
	} catch (err) {
		errs.push(`board: ${err instanceof Error ? err.message : err}`);
	}
	if (errs.length) console.warn("mc errs", errs);
	return outbox({ ok: !errs.length, n: evs.length, board: bd, errs }, path);
});

async function handle(ev: any, ch: st.chans, was: st.dude[]) {
	switch (ev.t) {
		case "chat": {
			const who = nm(ev.who), msg = tx(ev.msg);
			if (!ch.chat || !who || !msg.trim()) return;
			await say(ch.chat, `**${esc(who)}** » ${msg}`);
			return;
		}
		case "join":
		case "dip": {
			const who = nm(ev.who);
			if (!who) return;
			await st.seen([who]);
			if (ch.chat && ev.loud !== false) {
				await say(ch.chat, ev.t === "join" ? `📥 **${esc(who)}** joined the game` : `📤 **${esc(who)}** left the game`);
			}
			return;
		}
		case "rip": {
			const who = nm(ev.who);
			if (!who) return;
			const total = await st.rip(who);
			if (!ch.deaths) return;
			await drop(ch.deaths, [ripcard({
				who, msg: tx(ev.msg) || `${who} died`, dim: dm(ev.dim),
				x: int(ev.x), y: int(ev.y), z: int(ev.z), total,
			})]);
			return;
		}
		case "gg": {
			const by = nm(ev.by), who = nm(ev.who);
			if (!by || !who) return;
			const kills = await st.gg(by);
			if (!ch.kills) return;
			if (env.teamonly && !(await st.owner(by))) return;
			await drop(ch.kills, [ggcard({
				by, who, wep: tx(ev.wep, 64) || "Fists",
				hp: fl(ev.hp, 2048), maxhp: fl(ev.maxhp, 2048) || 20,
				msg: tx(ev.msg) || `${who} was slain by ${by}`, dim: dm(ev.dim),
				x: int(ev.x), y: int(ev.y), z: int(ev.z),
				kills, deaths: await st.deaths(who),
			})]);
			return;
		}
		case "world": {
			if (ev.up) {
				await st.setcursor(flake());
				if (ch.chat) await say(ch.chat, "🟢 **The world is open!** Hop on.");
			} else {
				await st.seen(was.map((p) => p.name));
				if (ch.chat) await say(ch.chat, "🔴 **The world was closed.** See you next time!");
			}
			return;
		}
		case "ppl":
			return;
		default:
			throw new Error("unknown event");
	}
}
