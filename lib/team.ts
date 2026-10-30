import { dc } from "./dc.js";
import { env } from "./env.js";

export const okname = /^[A-Za-z0-9_]{3,16}$/;

type member = { nick?: string | null; user: { id: string; bot?: boolean } };

const pat = () => new RegExp(`^${env.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*([A-Za-z0-9_]{3,16})\\s*$`, "i");

export const nick = (ign: string) => `${env.prefix} ${ign}`.slice(0, 32);

export function ignof(n: string | null | undefined) {
	const m = (n ?? "").trim().match(pat());
	return m ? m[1] : null;
}

export async function team(): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	let after = "0";
	for (let page = 0; page < 10; page++) {
		const list = await dc<member[]>("GET", `/guilds/${env.guild}/members?limit=1000&after=${after}`);
		for (const m of list) {
			if (m.user.bot) continue;
			const ign = ignof(m.nick);
			if (ign) out.set(m.user.id, ign);
		}
		if (list.length < 1000) break;
		after = list[list.length - 1].user.id;
	}
	return out;
}

export function owner(tm: Map<string, string>, ign: string) {
	for (const [id, n] of tm) if (n.toLowerCase() === ign.toLowerCase()) return id;
	return null;
}
