import { blurple, esc, orange, red, t, wrap as card } from "../lib/cards.js";
import { connect, disconnect, perms } from "../lib/cmds.js";
import { dc, dcerr, nopings, quiet, v2 } from "../lib/dc.js";
import { env } from "../lib/env.js";
import * as give from "../lib/give.js";
import { goal } from "../lib/goals.js";
import { json, wrap } from "../lib/guard.js";
import { ban, has, opt, timeout, unban } from "../lib/mod.js";
import { ignof, nick, okname, owner, team, teamok } from "../lib/team.js";

export const POST = wrap(async (r) => {
	const raw = await r.text();
	if (raw.length > 65536) return new Response("too big", { status: 413 });
	const ts = r.headers.get("x-signature-timestamp") ?? "";
	const sig = r.headers.get("x-signature-ed25519") ?? "";
	if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return new Response("stale", { status: 401 });
	if (!(await legit(raw, sig, ts, env.pub))) return new Response("bad sig", { status: 401 });

	const i = JSON.parse(raw);
	if (i.type === 1) return json({ type: 1 });
	if (i.type !== 2) return reply("Unknown action.");
	if (!i.guild_id || !i.member) return reply("Use this command in the Futile server.");
	if (i.guild_id !== env.guild) return reply("This bot only works in the Futile server.");

	const name = i.data?.name;
	const os = i.data?.options ?? [];
	const sub = os[0]?.type === 1 ? os[0] : null;

	try {
		switch (name) {
			case connect: return reply(await link(i));
			case disconnect: return reply(await unlink(i));
			case "timeout":
				if (!has(i, perms.timeout)) return reply("You need the Timeout Members permission.");
				return reply(await timeout(i, os, true), false);
			case "untimeout":
				if (!has(i, perms.timeout)) return reply("You need the Timeout Members permission.");
				return reply(await timeout(i, os, false), false);
			case "ban":
				if (!has(i, perms.ban)) return reply("You need the Ban Members permission.");
				return reply(await ban(i, os), false);
			case "unban":
				if (!has(i, perms.ban)) return reply("You need the Ban Members permission.");
				return reply(await unban(i, os), false);
			case "giveaway": {
				if (!has(i, perms.manage)) return reply("You need the Manage Server permission.");
				const o = sub?.options ?? [];
				if (sub?.name === "start") return reply(await give.start(i, String(opt(o, "prize") ?? ""), Number(opt(o, "minutes") ?? 0), Number(opt(o, "winners") ?? 1)));
				if (sub?.name === "end") return reply(await give.end(i, opt(o, "message_id")));
				if (sub?.name === "reroll") return reply(await give.reroll(i, opt(o, "message_id")));
				return reply("Unknown giveaway command.");
			}
			case "goal":
				return reply(await goal(sub?.name ?? "", sub?.options ?? []));
		}
	} catch (err) {
		console.error(err);
		if (err instanceof dcerr && (err.code === 50001 || err.code === 50013)) return reply("I don't have access to that channel. Check my permissions.");
		return reply("Something went wrong. Please try again.");
	}
	give.due().catch(() => 0);
	return reply("Unknown command.");
});

const bad = /^(You need|You can't|You are not|I can't|I couldn't|I don't|That is not|That user|There is no|There are no|There is nobody|Use this|This bot|Unknown|Pick a|Write what|Something went wrong|The list is full|\*\*.+\*\* is already)/;

const reply = (content: string, hidden = true) =>
	json({
		type: 4,
		data: {
			flags: (hidden ? quiet : 0) | v2,
			components: [card(bad.test(content) ? red : hidden ? blurple : orange, [t(content)])],
			allowed_mentions: nopings,
		},
	});

async function link(i: any) {
	const u = i.member.user;
	const ign = String(opt(i.data.options, "username") ?? "").trim();
	if (!okname.test(ign)) return "That is not a valid Minecraft name. Use 3 to 16 letters, numbers or _.";

	const tm = await team();
	if (!teamok) return "I can't read the member list. An admin needs to turn on Server Members Intent for the bot.";
	const own = owner(tm, ign);
	if (own && own !== u.id) return `**${esc(ign)}** is already linked to <@${own}>.`;

	const n = nick(ign);
	try {
		await dc("PATCH", `/guilds/${i.guild_id}/members/${u.id}`, { nick: n });
		return `Linked to **${esc(ign)}**. Your nickname is now \`${n}\`.`;
	} catch (err) {
		if (err instanceof dcerr && err.code === 50013) {
			return `I can't change your nickname because you own the server or your role is above mine. Please set your nickname to \`${n}\` yourself. That links your account.`;
		}
		return "I couldn't change your nickname. Please try again.";
	}
}

async function unlink(i: any) {
	const u = i.member.user;
	if (!ignof(i.member?.nick)) return `You are not linked. Use /${connect} first.`;
	try {
		await dc("PATCH", `/guilds/${i.guild_id}/members/${u.id}`, { nick: null });
		return "Unlinked. Your nickname was reset.";
	} catch {
		return "I can't change your nickname. Remove the futile part from it yourself to unlink.";
	}
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
