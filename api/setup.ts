import { defs } from "../lib/cmds.js";
import { dc } from "../lib/dc.js";
import { env, report } from "../lib/env.js";
import { banned, ip, same, sus, wrap } from "../lib/guard.js";

const page = (body: string, s = 200) =>
	new Response(
		`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>futile setup</title>
<style>body{font-family:system-ui,sans-serif;background:#1e1f22;color:#dbdee1;max-width:560px;margin:40px auto;padding:0 16px}
input,button{font:inherit;padding:10px;border-radius:8px;border:0;width:100%;box-sizing:border-box;margin-top:8px}
button{background:#5865f2;color:#fff;cursor:pointer}code,pre{background:#2b2d31;padding:2px 6px;border-radius:6px;white-space:pre-wrap;word-break:break-all}
.ok{color:#57f287}.bad{color:#ed4245}</style></head><body><h1>futile setup</h1>${body}</body></html>`,
		{
			status: s,
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
				"x-frame-options": "DENY",
				"content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
				"referrer-policy": "no-referrer",
			},
		},
	);

const form = (msg = "") =>
	page(`${msg}<p>Paste the <b>key</b> from your mod config (same as <code>mc_key</code> on Vercel).</p>
<form method="post"><input type="password" name="key" placeholder="key" autocomplete="off" required><button>run setup</button></form>`);

const tick = (b: boolean) => (b ? `<span class="ok">✔</span>` : `<span class="bad">✘</span>`);
const clean = (s: string) => s.replace(/[<>&"]/g, "");

export const GET = wrap(async () => form());

export const POST = wrap(async (r) => {
	const who = ip(r);
	if (await banned(who)) return form(`<p class="bad">Too many wrong tries. Wait 15 min.</p>`);
	const key = new URLSearchParams(await r.text()).get("key") ?? "";
	if (!same(key.trim(), env.key)) {
		await sus(who);
		return form(`<p class="bad">Wrong key.</p>`);
	}

	const cfg = report();
	let out = `<h3>settings</h3>${Object.entries(cfg).map(([k, v]) => `${tick(v)} <code>${k}</code>`).join("<br>")}`;

	try {
		const done = await dc<{ name: string }[]>("PUT", `/applications/${env.app}/guilds/${env.guild}/commands`, defs);
		out += `<h3>slash commands</h3>${tick(true)} ${done.map((c) => "/" + clean(c.name)).join(", ")}`;
	} catch (err) {
		out += `<h3>slash commands</h3>${tick(false)} ${clean(String(err instanceof Error ? err.message : err))}`;
	}

	const host = clean(r.headers.get("x-forwarded-host") ?? new URL(r.url).host);
	const url = `https://${host}/api/discord`;
	try {
		await dc("PATCH", "/applications/@me", { interactions_endpoint_url: url });
		out += `<h3>interactions url</h3>${tick(true)} <code>${url}</code>`;
	} catch {
		out += `<h3>interactions url</h3>${tick(false)} paste <code>${url}</code> into Developer Portal → General Information → Interactions Endpoint URL`;
	}
	return page(out);
});
