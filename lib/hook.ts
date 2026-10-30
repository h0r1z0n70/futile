import { head } from "./cards.js";
import { dc, dcerr, nopings, say } from "./dc.js";
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

export type post = { who: string | null; text: string };

const cleanname = (s: string) => s.replace(/discord|clyde/gi, (m) => m[0] + "​" + m.slice(1)).slice(0, 80) || "Server";

export async function send(ch: string, posts: post[], srv: string) {
	if (!posts.length) return;
	const merged: post[] = [];
	for (const p of posts) {
		const last = merged[merged.length - 1];
		if (last && last.who === p.who && last.text.length + p.text.length + 1 <= 1900) last.text += "\n" + p.text;
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
			await say(ch, p.who ? `**${p.who}**: ${p.text}` : p.text);
			continue;
		}
		try {
			await dc("POST", `/webhooks/${w.id}/${w.token}`, {
				content: p.text.slice(0, 2000),
				username: cleanname(p.who ?? srv ?? "Server"),
				avatar_url: p.who ? head(p.who) : undefined,
				allowed_mentions: nopings,
			}, { noauth: true });
		} catch (err) {
			if (err instanceof dcerr && (err.code === 10015 || err.status === 404)) {
				cache.delete(ch);
				await say(ch, p.who ? `**${p.who}**: ${p.text}` : p.text);
			} else throw err;
		}
	}
}
