import { dc, flake } from "../lib/dc.js";
import { due } from "../lib/give.js";
import { inbox, outbox, race, wrap } from "../lib/guard.js";
import { team } from "../lib/team.js";

const path = "/api/poll";
const isflake = (s: unknown): s is string => typeof s === "string" && /^\d{15,21}$/.test(s);

type dcmsg = {
	id: string;
	type: number;
	content: string;
	webhook_id?: string;
	author: { id: string; username: string; global_name?: string | null; bot?: boolean };
	mentions?: { id: string; username: string; global_name?: string | null }[];
	attachments?: unknown[];
	sticker_items?: unknown[];
};

export const POST = wrap(async (r) => {
	const got = await inbox(r, path);
	if (got instanceof Response) return got;
	const b = got.b;
	await race(due().catch(() => 0), 1500);

	const chat = isflake(b.ch?.chat) ? b.ch.chat : null;
	if (!chat) return outbox({ msgs: [], note: "no chat channel" }, path);
	if (!isflake(b.cur)) return outbox({ msgs: [], cur: flake() }, path);

	const batch = await dc<dcmsg[]>("GET", `/channels/${chat}/messages?after=${b.cur}&limit=50`);
	if (!batch.length) return outbox({ msgs: [], cur: b.cur }, path);

	batch.sort((x, y) => (BigInt(x.id) < BigInt(y.id) ? -1 : 1));
	const cur = batch[batch.length - 1].id;

	const real = batch.filter((m) => !m.author?.bot && !m.webhook_id && (m.type === 0 || m.type === 19));
	if (!real.length) return outbox({ msgs: [], cur }, path);

	const tm = await team();
	const ign = (id: string) => tm.get(id);

	const msgs = real
		.map((m) => {
			const me = ign(m.author.id);
			let txt = clean(m, ign);
			const files = m.attachments?.length ?? 0;
			if (files) txt += `${txt ? " " : ""}[${files} ${files === 1 ? "file" : "files"}]`;
			if (m.sticker_items?.length) txt += `${txt ? " " : ""}[sticker]`;
			if (txt.length > 256) txt = txt.slice(0, 253) + "...";
			return { who: (me ?? m.author.global_name ?? m.author.username).slice(0, 32), team: !!me, txt };
		})
		.filter((m) => m.txt);

	return outbox({ msgs, cur }, path);
});

function clean(m: dcmsg, ign: (id: string) => string | undefined) {
	let s = m.content ?? "";
	for (const u of m.mentions ?? []) {
		s = s.replace(new RegExp(`<@!?${u.id}>`, "g"), "@" + (ign(u.id) ?? u.global_name ?? u.username));
	}
	return s
		.replace(/<@!?\d+>/g, "@someone")
		.replace(/<@&\d+>/g, "@role")
		.replace(/<#\d+>/g, "#channel")
		.replace(/<a?:(\w+):\d+>/g, ":$1:")
		.replace(/<t:(\d+)(?::\w)?>/g, (_, x) => new Date(Number(x) * 1000).toISOString().slice(0, 16).replace("T", " "))
		.replace(/§/g, "")
		.replace(/\s*\n\s*/g, " ")
		.trim();
}
