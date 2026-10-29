import { env } from "./env.js";

type arg = string | number;

async function hit(path: string, body: unknown): Promise<any> {
	const r = await fetch(env.rurl.replace(/\/$/, "") + path, {
		method: "POST",
		headers: { authorization: `Bearer ${env.rtok}`, "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	const j = await r.json().catch(() => null);
	if (!r.ok || j === null) throw new Error(`redis said ${r.status}`);
	return j;
}

export async function db<t = unknown>(...c: arg[]): Promise<t> {
	const j = await hit("", c.map(String));
	if (j.error) throw new Error(`redis ${c[0]}: ${j.error}`);
	return j.result as t;
}

export async function pipe(cs: arg[][]): Promise<unknown[]> {
	if (!cs.length) return [];
	const j = await hit("/pipeline", cs.map((c) => c.map(String)));
	if (!Array.isArray(j)) throw new Error("redis pipeline broke");
	return j.map((r: any) => {
		if (r.error) throw new Error(`redis: ${r.error}`);
		return r.result;
	});
}

export const kv = (flat: unknown): Record<string, string> => {
	const o: Record<string, string> = {};
	if (Array.isArray(flat)) for (let i = 0; i + 1 < flat.length; i += 2) o[String(flat[i])] = String(flat[i + 1]);
	return o;
};
