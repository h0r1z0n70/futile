const box = 17, sec = 9, txt = 10, thumb = 11, line = 14;

export const red = 0xed4245, yellow = 0xfee75c, orange = 0xe67e22, blurple = 0x5865f2, grey = 0x4e5058, green = 0x57f287;

export const t = (content: string) => ({ type: txt, content: content.slice(0, 4000) });
export const hr = () => ({ type: line, divider: true, spacing: 1 });
export const wrap = (color: number, components: unknown[]) => ({ type: box, accent_color: color, components });
const side = (pic: string, ...texts: string[]) => ({
	type: sec,
	components: texts.map(t),
	accessory: { type: thumb, media: { url: pic } },
});

export const esc = (s: string) => String(s ?? "").replace(/([\\*_~`|])/g, "\\$1");
export const head = (name: string) => `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`;
export const when = (ms: number, style = "f") => `<t:${Math.floor(ms / 1000)}:${style}>`;

export function dimname(id?: string) {
	switch (id) {
		case "minecraft:overworld": return "Overworld";
		case "minecraft:the_nether": return "Nether";
		case "minecraft:the_end": return "End";
		default: return id ? id.replace(/^minecraft:/, "") : "";
	}
}

export type pos = { dim: string; x: number; y: number; z: number } | null;

const place = (p: pos) => (p ? `Place: ${dimname(p.dim) || "unknown"}, ${p.x} ${p.y} ${p.z}\n` : "");
const foot = (srv: string) => `-# ${srv ? esc(srv) + ", " : ""}${when(Date.now())}`;

export type ripinfo = { who: string; msg: string; at: pos; total: number; srv: string };

export function ripcard(d: ripinfo) {
	return wrap(red, [
		side(head(d.who), `## ${esc(d.who)} died`, `> ${esc(d.msg)}`),
		hr(),
		t(`${place(d.at)}Total deaths: **${d.total}**`),
		t(foot(d.srv)),
	]);
}

export type gginfo = {
	by: string; who: string; wep: string; hp: number | null; maxhp: number;
	msg: string; at: pos; kills: number; deaths: number; srv: string;
};

export function ggcard(g: gginfo) {
	const hp = g.hp === null ? "" : `Health left: ${(g.hp / 2).toFixed(1)} / ${Math.round(g.maxhp / 2)} hearts\n`;
	return wrap(orange, [
		t(`## ${esc(g.by)} vs ${esc(g.who)}`),
		hr(),
		side(head(g.by), `### ${esc(g.by)} won\n${hp}Weapon: ${esc(g.wep)}\nTotal kills: **${g.kills}**`),
		side(head(g.who), `### ${esc(g.who)} lost\nTotal deaths: **${g.deaths}**`),
		hr(),
		t(`> ${esc(g.msg)}`),
		t((g.at ? `-# ${place(g.at)}` : "") + foot(g.srv)),
	]);
}

export type row = { name: string; on: boolean; dim?: string; seen: number; team: boolean };

const ansi = { yellow: "\u001b[1;33m", red: "\u001b[1;31m", grey: "\u001b[0;30m", end: "\u001b[0m" };
const maxblock = 3300;

export function stamp(ms: number, tz: number) {
	const d = new Date(ms + tz * 3600_000);
	const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
	const hh = String(d.getUTCHours()).padStart(2, "0");
	const mm = String(d.getUTCMinutes()).padStart(2, "0");
	return `${mon} ${d.getUTCDate()} ${hh}:${mm}`;
}

export function boardcards(rows: row[], up: boolean, srv: string, tz: number) {
	const on = rows.filter((r) => r.on).length;
	const teamall = rows.filter((r) => r.team).length;
	const teamon = rows.filter((r) => r.team && r.on).length;
	const pad = Math.min(16, Math.max(8, ...rows.map((r) => r.name.length)));

	let top = `## Futile players${srv ? ` on ${esc(srv)}` : ""}\n`;
	top += `**${on}** of **${rows.length}** recorded players are online.`;
	if (teamall) top += ` Teammates online: **${teamon}** of **${teamall}**.`;
	if (!up) top += "\nNo teammate is on the server right now, so this list can be out of date.";

	const lines: string[] = [];
	let size = 0;
	let hidden = 0;
	for (const r of rows) {
		const tag = r.team ? " [team]" : "";
		const l = r.on
			? `${ansi.yellow}${r.name.padEnd(pad)}  online${r.dim ? ` (${dimname(r.dim)})` : ""}${tag}${ansi.end}`
			: `${ansi.red}${r.name.padEnd(pad)}  ${r.seen ? `last seen ${stamp(r.seen, tz)}` : "not seen yet"}${tag}${ansi.end}`;
		if (size + l.length + 1 > maxblock) {
			hidden++;
			continue;
		}
		lines.push(l);
		size += l.length + 1;
	}
	if (hidden) lines.push(`${ansi.grey}and ${hidden} more${ansi.end}`);
	if (!lines.length) lines.push(`${ansi.grey}Nobody recorded yet. Join ${srv || "the server"} with the mod on.${ansi.end}`);

	const color = on ? yellow : rows.length ? red : grey;
	return [wrap(color, [
		t(top),
		t("```ansi\n" + lines.join("\n") + "\n```"),
		t(`-# Yellow means online. Red means offline. Times are UTC${tz >= 0 ? "+" : ""}${tz}. Updated ${when(Date.now(), "R")}`),
	])];
}
