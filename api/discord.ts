import { board } from "../lib/board.js";
import { esc } from "../lib/cards.js";
import { connect, disconnect } from "../lib/cmds.js";
import { dc, dcerr, nopings, quiet } from "../lib/dc.js";
import { env } from "../lib/env.js";
import { json, race, wrap } from "../lib/guard.js";
import * as st from "../lib/store.js";

const okname = /^[A-Za-z0-9_]{3,16}$/;

export const POST = wrap(async (r) => {
	const raw = await r.text();
	if (raw.length > 65536) return new Response("too big", { status: 413 });
	const ts = r.headers.get("x-signature-timestamp") ?? "";
	const sig = r.headers.get("x-signature-ed25519") ?? "";
	if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return new Response("stale", { status: 401 });
	if (!(await legit(raw, sig, ts, env.pub))) return new Response("bad sig", { status: 401 });

	const i = JSON.parse(raw);
	if (i.type === 1) return json({ type: 1 });
	if (i.type === 2) {
		if (i.guild_id && i.guild_id !== env.guild) return reply("Wrong server.");
		if (i.data?.name === connect) return reply(await link(i));
		if (i.data?.name === disconnect) return reply(await unlink(i));
	}
	return reply("Unknown command.");
});

const reply = (content: string) => json({ type: 4, data: { content, flags: quiet, allowed_mentions: nopings } });

async function link(i: any) {
	const u = i.member?.user;
	if (!u || !i.guild_id) return "Use this inside the Futile server, not in DMs.";
	const ign = String(i.data.options?.find((o: any) => o.name === "username")?.value ?? "").trim();
	if (!okname.test(ign)) return `❌ \`${esc(ign.slice(0, 32))}\` isn't a valid Minecraft name (3-16 letters, numbers or _).`;

	const own = await st.owner(ign);
	if (own && own !== u.id) return `❌ **${esc(ign)}** is already linked to <@${own}>.`;
	await st.hook(u.id, u.username, ign);

	const nick = (env.prefix + ign).slice(0, 32);
	let note: string;
	try {
		await dc("PATCH", `/guilds/${i.guild_id}/members/${u.id}`, { nick });
		note = `Your nickname is now \`${nick}\`.`;
	} catch (err) {
		note = err instanceof dcerr && err.code === 50013
			? `⚠️ I can't rename you (you're the owner or your role is above mine). Set your nickname to \`${nick}\` yourself.`
			: "⚠️ Couldn't change your nickname, try again later.";
	}
	await race(board().catch(() => ""), 1500);
	return `✅ Linked to **${esc(ign)}**! ${note}`;
}

async function unlink(i: any) {
	const u = i.member?.user ?? i.user;
	const gone = await st.unhook(u.id);
	if (!gone) return `You aren't linked. Use \`/${connect}\` first.`;
	if (i.guild_id) await dc("PATCH", `/guilds/${i.guild_id}/members/${u.id}`, { nick: null }).catch(() => undefined);
	await race(board().catch(() => ""), 1500);
	return `👋 Unlinked **${esc(gone.ign)}**.`;
}

export async function legit(body: string, sig: string, ts: string, pub: string) {
	if (!/^[0-9a-f]{128}$/i.test(sig) || !/^[0-9a-f]{64}$/i.test(pub)) return false;
	try {
		const key = await crypto.subtle.importKey("raw", hex(pub), { name: "Ed25519" }, false, ["verify"]);
		return await crypto.subtle.verify({ name: "Ed25519" }, key, hex(sig), new TextEncoder().encode(ts + body));
	} catch {
		return false;
	}
}

function hex(s: string): Uint8Array<ArrayBuffer> {
	const o = new Uint8Array(s.length / 2);
	for (let i = 0; i < o.length; i++) o[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
	return o;
}
