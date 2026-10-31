import { head } from "./cards.js";
import { dc, dcerr, nopings } from "./dc.js";
import { env } from "./env.js";

type wh = { id: string; token: string };
const cache = new Map<string, wh | null>();

async function find(ch: string): Promise<wh | null> {
	if (cache.has(ch)) return cache.get(ch) ?? null;
	try {
		const list = await dc<{ id: string; token?: string; user?: { id: string } }[]>("GET", `/channels/${ch}/webhooks`);
		let w = list.find((x) => x.user?.id === env.app && x.token);
		if (!w) w = await dc<{ id: string; token: string }>("POST", `/channels/${ch}/webhooks`, { name: "Futile Chat" });
		const got = w && w.token ? { id: w.id, token: w.token } : null;
		cache.set(ch, got);
		return got;
	} catch (err) {
		if (err instanceof dcerr && (err.code === 50013 || err.status === 403)) {
			cache.set(ch, null);
			return null;
		}
		throw err;
	}
}

export type post = { who: string | null; text: string; ping?: boolean };

const loud = { parse: ["everyone"] };

const cleanname = (s: string) => s.replace(/discord|clyde/gi, (m) => m[0] + "​" + m.slice(1)).slice(0, 80) || "Server";

const age = (id: string) => Date.now() - Number((BigInt(id) >> 22n) + 1420070400000n);

async function already(ch: string): Promise<Set<string>> {
	const out = new Set<string>();
	try {
		const list = await dc<{ id: string; content?: string; author?: { username?: string } }[]>("GET", `/channels/${ch}/messages?limit=50`);
		for (const m of list) {
			if (age(m.id) > 5 * 60_000) continue;
			const who = (m.author?.username ?? "").toLowerCase();
			for (const l of (m.content ?? "").split("\n")) {
				out.add(`${who}|${l}`);
				const x = l.match(/^\*\*([A-Za-z0-9_]{1,16})\*\*: (.*)$/);
				if (x) out.add(`${x[1].toLowerCase()}|${x[2]}`);
			}
		}
	} catch {
		return out;
	}
	return out;
}

const plain = (ch: string, p: post) =>
	dc("POST", `/channels/${ch}/messages`, {
		content: (p.who ? `**${p.who}**: ${p.text}` : p.text).slice(0, 2000),
		allowed_mentions: p.ping ? loud : nopings,
	});

export async function send(ch: string, all: post[], srv: string) {
	if (!all.length) return;
	const seen = await already(ch);
	const posts = all.filter((p) => !seen.has(`${(p.who ?? cleanname(srv || "Server")).toLowerCase()}|${p.text}`));
	if (!posts.length) return;
	const merged: post[] = [];
	for (const p of posts) {
		const last = merged[merged.length - 1];
		if (last && last.who === p.who && !!last.ping === !!p.ping && last.text.length + p.text.length + 1 <= 1900) last.text += "\n" + p.text;
		else merged.push({ ...p });
	}
	let list = merged;
	if (list.length > 8) {
		const rest = list.slice(7).map((p) => (p.who ? `**${p.who}**: ${p.text}` : p.text)).join("\n").slice(0, 1900);
		list = [...list.slice(0, 7), { who: null, text: rest }];
	}

	const w = await find(ch);
	for (const p of list) {
		if (!w) {
			await plain(ch, p);
			continue;
		}
		try {
			await dc("POST", `/webhooks/${w.id}/${w.token}`, {
				content: p.text.slice(0, 2000),
				username: cleanname(p.who ?? srv ?? "Server"),
				avatar_url: p.who ? head(p.who) : undefined,
				allowed_mentions: p.ping ? loud : nopings,
			}, { noauth: true });
		} catch (err) {
			if (err instanceof dcerr && (err.code === 10015 || err.status === 404)) {
				cache.delete(ch);
				await plain(ch, p);
			} else throw err;
		}
	}
}
