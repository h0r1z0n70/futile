import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cfgerr, env } from "./env.js";

const alg = "chacha20-poly1305";

const key = () => {
	const k = Buffer.from(env.key, "base64url");
	if (k.length !== 32) throw new cfgerr("mc_key has to be 32 bytes base64url (copy it from the mod config)");
	return k;
};

export type sealed = { n: string; d: string };

export function seal(obj: unknown, aad: string): sealed {
	const n = randomBytes(12);
	const c = createCipheriv(alg, key(), n, { authTagLength: 16 });
	c.setAAD(Buffer.from(aad));
	const d = Buffer.concat([c.update(Buffer.from(JSON.stringify(obj))), c.final(), c.getAuthTag()]);
	return { n: n.toString("base64url"), d: d.toString("base64url") };
}

export function open(s: any, aad: string): any {
	try {
		if (!s || typeof s.n !== "string" || typeof s.d !== "string") return null;
		const n = Buffer.from(s.n, "base64url");
		const d = Buffer.from(s.d, "base64url");
		if (n.length !== 12 || d.length < 17) return null;
		const c = createDecipheriv(alg, key(), n, { authTagLength: 16 });
		c.setAAD(Buffer.from(aad));
		c.setAuthTag(d.subarray(d.length - 16));
		const pt = Buffer.concat([c.update(d.subarray(0, d.length - 16)), c.final()]);
		return JSON.parse(pt.toString("utf8"));
	} catch (err) {
		if (err instanceof cfgerr) throw err;
		return null;
	}
}
