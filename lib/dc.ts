import { env } from "./env.js";

const api = "https://discord.com/api/v10";

export const v2 = 1 << 15;
export const quiet = 1 << 6;
export const nopings = { parse: [] as string[] };

export class dcerr extends Error {
	constructor(public status: number, public code: number, m: string) {
		super(m);
	}
}

const nap = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function dc<t = any>(method: string, path: string, body?: unknown, opt: { why?: string; noauth?: boolean } = {}): Promise<t> {
	for (let i = 0; i < 3; i++) {
		const headers: Record<string, string> = {
			"content-type": "application/json",
			"user-agent": "DiscordBot (https://futile.local, 4.0)",
		};
		if (!opt.noauth) headers.authorization = `Bot ${env.tok}`;
		if (opt.why) headers["x-audit-log-reason"] = encodeURIComponent(opt.why.slice(0, 400));
		const r = await fetch(api + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
		if (r.status === 429) {
			const info = (await r.json().catch(() => ({}))) as { retry_after?: number };
			await nap(Math.min(5, info.retry_after ?? 1) * 1000);
			continue;
		}
		if (r.status === 204) return undefined as t;
		const j = (await r.json().catch(() => ({}))) as any;
		if (!r.ok) throw new dcerr(r.status, j?.code ?? 0, `discord ${method} ${path.split("?")[0]} -> ${r.status} ${j?.message ?? ""}`);
		return j as t;
	}
	throw new dcerr(429, 0, `discord ${method} ${path} kept rate limiting`);
}

export const say = (ch: string, txt: string, pings: string[] = []) =>
	dc<{ id: string }>("POST", `/channels/${ch}/messages`, {
		content: txt.slice(0, 2000),
		allowed_mentions: pings.length ? { parse: [], users: pings.slice(0, 100) } : nopings,
	});

export const drop = (ch: string, comps: unknown[]) =>
	dc<{ id: string }>("POST", `/channels/${ch}/messages`, { flags: v2, components: comps, allowed_mentions: nopings });

export const redo = (ch: string, id: string, comps: unknown[]) =>
	dc("PATCH", `/channels/${ch}/messages/${id}`, { flags: v2, components: comps, allowed_mentions: nopings });

export type msg = { id: string; author: { id: string; bot?: boolean }; flags?: number; content?: string; components?: any[] };

export const recent = (ch: string, n = 25) => dc<msg[]>("GET", `/channels/${ch}/messages?limit=${n}`);

export const mine = (m: msg) => m.author?.id === env.app && !!((m.flags ?? 0) & v2);

export function textof(m: msg): string {
	const out: string[] = [];
	const walk = (cs: any[] | undefined) => {
		for (const c of cs ?? []) {
			if (c?.type === 10 && typeof c.content === "string") out.push(c.content);
			walk(c?.components);
		}
	};
	walk(m.components);
	return out.join("\n");
}

export const flake = () => ((BigInt(Date.now()) - 1420070400000n) << 22n).toString();
