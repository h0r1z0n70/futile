const e: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};

export class cfgerr extends Error {}

export const get = (k: string) => {
	const v = e[k]?.trim();
	return v ? v : undefined;
};

const need = (k: string) => {
	const v = get(k);
	if (!v) throw new cfgerr(`missing env var ${k}`);
	return v;
};

const flag = (k: string, def: boolean) => {
	const v = get(k);
	return v === undefined ? def : v.toLowerCase() !== "false";
};

export const env = {
	get tok() { return need("discord_token"); },
	get pub() { return need("discord_pubkey"); },
	get app() { return need("discord_app_id"); },
	get guild() { return need("discord_guild_id"); },
	get key() { return need("mc_key"); },
	get prefix() { return (get("nick_prefix") ?? "futile |").trim(); },
	get teamonly() { return flag("kills_only_team", true); },
	get deathsteam() { return flag("deaths_only_team", true); },
	get goals() { return get("goals_channel") ?? "1564671542648905769"; },
	get gwch() { return get("giveaway_channel") ?? ""; },
	get tz() {
		const n = Number(get("tz") ?? "8");
		return Number.isFinite(n) && Math.abs(n) <= 14 ? n : 8;
	},
};

export const report = () => ({
	discord_token: !!get("discord_token"),
	discord_pubkey: !!get("discord_pubkey"),
	discord_app_id: !!get("discord_app_id"),
	discord_guild_id: !!get("discord_guild_id"),
	mc_key: !!get("mc_key"),
});
