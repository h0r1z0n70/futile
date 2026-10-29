const e: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};

export class cfgerr extends Error {}

export const get = (k: string) => {
	const v = e[k]?.trim();
	return v ? v : undefined;
};

const need = (k: string, ...alts: string[]) => {
	for (const x of [k, ...alts]) {
		const v = get(x);
		if (v) return v;
	}
	throw new cfgerr(`missing env var ${k}`);
};

export const env = {
	get tok() { return need("discord_token"); },
	get pub() { return need("discord_pubkey"); },
	get app() { return need("discord_app_id"); },
	get guild() { return need("discord_guild_id"); },
	get key() { return need("mc_key"); },
	get rurl() { return need("redis_url", "KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"); },
	get rtok() { return need("redis_token", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"); },
	get prefix() {
		const p = get("nick_prefix") ?? "futile |";
		return p.endsWith(" ") ? p : p + " ";
	},
	get teamonly() { return (get("kills_only_team") ?? "true").toLowerCase() !== "false"; },
};

export const report = () => ({
	discord_token: !!get("discord_token"),
	discord_pubkey: !!get("discord_pubkey"),
	discord_app_id: !!get("discord_app_id"),
	discord_guild_id: !!get("discord_guild_id"),
	mc_key: !!get("mc_key"),
	redis: !!(get("redis_url") ?? get("KV_REST_API_URL") ?? get("UPSTASH_REDIS_REST_URL")),
});
