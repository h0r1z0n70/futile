import { dc, dcerr } from "./dc.js";
import { env } from "./env.js";

export const opt = (os: any[] | undefined, name: string) => os?.find((o: any) => o.name === name)?.value;

export function has(i: any, bit: bigint) {
	try {
		const p = BigInt(i.member?.permissions ?? "0");
		return (p & 8n) === 8n || (p & bit) === bit;
	} catch {
		return false;
	}
}

const span = (min: number) => {
	if (min % 1440 === 0) return `${min / 1440} day${min === 1440 ? "" : "s"}`;
	if (min % 60 === 0) return `${min / 60} hour${min === 60 ? "" : "s"}`;
	return `${min} minute${min === 1 ? "" : "s"}`;
};

const why = (i: any, reason: string) => `${i.member?.user?.username ?? "mod"}: ${reason || "no reason"}`;

function fail(err: unknown, what: string) {
	if (err instanceof dcerr) {
		if (err.code === 50013) return `I can't ${what}. My role must be above theirs and I need the right permission.`;
		if (err.code === 10007 || err.code === 10013) return "That user is not in the server.";
		if (err.code === 10026) return "That user is not banned.";
	}
	return `I couldn't ${what}. Please try again.`;
}

const clean = (s: unknown) => String(s ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 300);

export async function timeout(i: any, os: any[], on: boolean) {
	const who = String(opt(os, "user") ?? "");
	const me = i.member?.user?.id;
	if (!who) return "Pick a user.";
	if (who === me) return "You can't time out yourself.";
	if (who === env.app) return "I can't time out myself.";
	const min = Number(opt(os, "minutes") ?? 0);
	const reason = clean(opt(os, "reason"));
	const until = on ? new Date(Date.now() + min * 60_000).toISOString() : null;
	try {
		await dc("PATCH", `/guilds/${env.guild}/members/${who}`, { communication_disabled_until: until }, { why: why(i, reason) });
	} catch (err) {
		return fail(err, on ? "time out this user" : "remove this timeout");
	}
	if (!on) return `The timeout for <@${who}> was removed.`;
	return `<@${who}> was timed out for ${span(min)}.${reason ? ` Reason: ${reason}` : ""}`;
}

export async function ban(i: any, os: any[]) {
	const who = String(opt(os, "user") ?? "");
	if (!who) return "Pick a user.";
	if (who === i.member?.user?.id) return "You can't ban yourself.";
	if (who === env.app) return "I can't ban myself.";
	const reason = clean(opt(os, "reason"));
	const hours = Math.max(0, Math.min(168, Number(opt(os, "delete_hours") ?? 0)));
	try {
		await dc("PUT", `/guilds/${env.guild}/bans/${who}`, { delete_message_seconds: hours * 3600 }, { why: why(i, reason) });
	} catch (err) {
		return fail(err, "ban this user");
	}
	return `<@${who}> was banned.${reason ? ` Reason: ${reason}` : ""}`;
}

export async function unban(i: any, os: any[]) {
	const who = String(opt(os, "user_id") ?? "").trim();
	if (!/^\d{15,21}$/.test(who)) return "That is not a valid user id.";
	try {
		await dc("DELETE", `/guilds/${env.guild}/bans/${who}`, undefined, { why: why(i, "unban") });
	} catch (err) {
		return fail(err, "unban this user");
	}
	return `<@${who}> was unbanned.`;
}
