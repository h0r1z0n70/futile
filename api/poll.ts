import { dc, flake } from "../lib/dc.js";
import { inbox, outbox, wrap } from "../lib/guard.js";
import * as st from "../lib/store.js";

const path = "/api/poll";

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
	await st.savech(got.b.ch);

	const chat = (await st.getch()).chat;
	if (!chat) return outbox({ msgs: [], note: "no chat channel" }, path);

	const cur = await st.cursor();
	if (!cur) {
		await st.setcursor(flake());
		return outbox({ msgs: [] }, path);
	}

	const batch = await dc<dcmsg[]>("GET", `/channels/${chat}/messages?after=${cur}&limit=50`);
	if (!batch.length) return outbox({ msgs: [] }, path);

	batch.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
	await st.setcursor(batch[batch.length - 1].id);

	const ls = await st.links();
	const ign = (id: string) => ls[id]?.ign;

	const msgs = batch
		.filter((m) => !m.author?.bot && !m.webhook_id && (m.type === 0 || m.type === 19))
		.map((m) => {
			const me = ign(m.author.id);
			let txt = clean(m, ign);
			const files = m.attachments?.length ?? 0;
			if (files) txt += `${txt ? " " : ""}[📎 ${files} ${files === 1 ? "file" : "files"}]`;
			if (m.sticker_items?.length) txt += `${txt ? " " : ""}[sticker]`;
			if (txt.length > 256) txt = txt.slice(0, 253) + "...";
			return { who: (me ?? m.author.global_name ?? m.author.username).slice(0, 32), team: !!me, txt };
		})
		.filter((m) => m.txt);

	return outbox({ msgs }, path);
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
