import { blurple, esc, green, t, when, wrap } from "./cards.js";
import { dc, drop, mine, recent, redo, say, textof, type msg } from "./dc.js";
import { env } from "./env.js";

const mark = encodeURIComponent("✅");
const chans = new Set<string>();
let lastcheck = 0;

type gw = { m: msg; prize: string; n: number; end: number; host: string; done: boolean; winners: string[] };

function read(m: msg): gw | null {
	if (!mine(m)) return null;
	const s = textof(m);
	if (!s.startsWith("## Giveaway")) return null;
	const done = s.startsWith("## Giveaway ended");
	const prize = s.match(/\*\*Prize:\*\* (.+)/)?.[1] ?? "something";
	const n = Number(s.match(/\*\*Winners:\*\* (\d+)/)?.[1] ?? s.match(/winner count: (\d+)/)?.[1] ?? 1);
	const end = Number(s.match(/\*\*Ends:\*\* <t:(\d+):/)?.[1] ?? 0) * 1000;
	const host = s.match(/Hosted by <@(\d+)>/)?.[1] ?? "";
	const wl = s.match(/\*\*Won by:\*\* (.+)/)?.[1] ?? "";
	const winners = [...wl.matchAll(/<@(\d+)>/g)].map((x) => x[1]);
	return { m, prize, n: n || 1, end, host, done, winners };
}

const live = (g: gw) => [
	wrap(green, [
		t(`## Giveaway\n**Prize:** ${g.prize}\n**Winners:** ${g.n}\n**Ends:** ${when(g.end, "R")} (${when(g.end)})`),
		t(`Click the check mark under this message to join.\n-# Hosted by <@${g.host}>`),
	]),
];

const over = (g: gw, winners: string[]) => [
	wrap(blurple, [
		t(`## Giveaway ended\n**Prize:** ${g.prize}\n**Won by:** ${winners.length ? winners.map((w) => `<@${w}>`).join(", ") : "Nobody joined."}\n**Ended:** ${when(Date.now())}`),
		t(`-# Hosted by <@${g.host}>. winner count: ${g.n}`),
	]),
];

async function joiners(ch: string, id: string): Promise<string[]> {
	const out: string[] = [];
	let after = "0";
	for (let p = 0; p < 20; p++) {
		const list = await dc<{ id: string; bot?: boolean }[]>("GET", `/channels/${ch}/messages/${id}/reactions/${mark}?limit=100&after=${after}`);
		for (const u of list) if (!u.bot) out.push(u.id);
		if (list.length < 100) break;
		after = list[list.length - 1].id;
	}
	return out;
}

function pick(from: string[], n: number) {
	const pool = [...new Set(from)];
	const out: string[] = [];
	while (pool.length && out.length < n) {
		const r = new Uint32Array(1);
		crypto.getRandomValues(r);
		out.push(pool.splice(r[0] % pool.length, 1)[0]);
	}
	return out;
}

export async function start(i: any, prize: string, minutes: number, n: number) {
	const ch = env.gwch || i.channel_id;
	const g: gw = {
		m: { id: "", author: { id: "" } },
		prize: esc(prize.replace(/[\r\n]+/g, " ").trim()).slice(0, 200),
		n: Math.max(1, Math.min(20, n || 1)),
		end: Date.now() + minutes * 60_000,
		host: i.member?.user?.id ?? "",
		done: false,
		winners: [],
	};
	const m = await drop(ch, live(g));
	await dc("PUT", `/channels/${ch}/messages/${m.id}/reactions/${mark}/@me`);
	chans.add(ch);
	return `The giveaway started in <#${ch}>. It ends ${when(g.end, "R")}.`;
}

async function finish(ch: string, g: gw) {
	const winners = pick(await joiners(ch, g.m.id), g.n);
	await redo(ch, g.m.id, over(g, winners));
	if (winners.length) await say(ch, `Congratulations ${winners.map((w) => `<@${w}>`).join(", ")}! You won **${g.prize}**.`, winners);
	else await say(ch, `Nobody joined the giveaway for **${g.prize}**, so there is no winner.`);
	return winners;
}

async function findone(ch: string, id: string | undefined, done: boolean) {
	if (id && /^\d{15,21}$/.test(id)) {
		const m = await dc<msg>("GET", `/channels/${ch}/messages/${id}`).catch(() => null);
		const g = m ? read(m) : null;
		return g && g.done === done ? g : null;
	}
	for (const m of await recent(ch, 50)) {
		const g = read(m);
		if (g && g.done === done) return g;
	}
	return null;
}

export async function end(i: any, id?: string) {
	const ch = env.gwch || i.channel_id;
	const g = await findone(ch, id, false);
	if (!g) return "I can't find a running giveaway here.";
	const w = await finish(ch, g);
	return w.length ? "The giveaway ended and the winners were posted." : "The giveaway ended. Nobody joined.";
}

export async function reroll(i: any, id?: string) {
	const ch = env.gwch || i.channel_id;
	const g = await findone(ch, id, true);
	if (!g) return "I can't find an ended giveaway here.";
	const old = new Set(g.winners);
	const fresh = pick((await joiners(ch, g.m.id)).filter((u) => !old.has(u)), Math.max(1, g.winners.length || g.n));
	if (!fresh.length) return "There is nobody left to pick.";
	await redo(ch, g.m.id, over(g, fresh));
	await say(ch, `New winner for **${g.prize}**: ${fresh.map((w) => `<@${w}>`).join(", ")}. Congratulations!`, fresh);
	return "New winners were picked.";
}

export async function due(force = false) {
	const rn = Date.now();
	if (!force && rn - lastcheck < 30_000) return 0;
	lastcheck = rn;
	const list = new Set(chans);
	if (env.gwch) list.add(env.gwch);
	let n = 0;
	for (const ch of list) {
		for (const m of await recent(ch, 50).catch(() => [] as msg[])) {
			const g = read(m);
			if (g && !g.done && g.end && g.end <= rn) {
				await finish(ch, g);
				n++;
			}
		}
	}
	return n;
}
