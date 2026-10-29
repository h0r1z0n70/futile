const box = 17, sec = 9, txt = 10, thumb = 11, line = 14;

export const red = 0xed4245, yellow = 0xfee75c, orange = 0xe67e22, blurple = 0x5865f2, grey = 0x4e5058;

const maxrows = 17;

const t = (content: string) => ({ type: txt, content: content.slice(0, 4000) });
const hr = () => ({ type: line, divider: true, spacing: 1 });
const wrap = (color: number, components: unknown[]) => ({ type: box, accent_color: color, components });
const side = (pic: string, ...texts: string[]) => ({
	type: sec,
	components: texts.map(t),
	accessory: { type: thumb, media: { url: pic } },
});

export const esc = (s: string) => String(s ?? "").replace(/([\\*_~`|])/g, "\\$1");
export const head = (name: string) => `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`;
const when = (ms: number, style = "f") => `<t:${Math.floor(ms / 1000)}:${style}>`;

export function dimname(id?: string) {
	switch (id) {
		case "minecraft:overworld": return "Overworld";
		case "minecraft:the_nether": return "The Nether";
		case "minecraft:the_end": return "The End";
		default: return id ?? "???";
	}
}

export function dimemoji(id?: string) {
	switch (id) {
		case "minecraft:overworld": return "🌳";
		case "minecraft:the_nether": return "🔥";
		case "minecraft:the_end": return "🌌";
		default: return "🌍";
	}
}

export type ripinfo = { who: string; msg: string; dim: string; x: number; y: number; z: number; total: number };

export function ripcard(d: ripinfo) {
	return wrap(red, [
		side(head(d.who), `## 💀 ${esc(d.who)} died`, `> ${esc(d.msg)}`),
		hr(),
		t(`${dimemoji(d.dim)} **${dimname(d.dim)}**  ·  \`${d.x} ${d.y} ${d.z}\`\n☠️ Total deaths: **${d.total}**`),
		t(`-# ${when(Date.now())}`),
	]);
}

export type gginfo = {
	by: string; who: string; wep: string; hp: number; maxhp: number;
	msg: string; dim: string; x: number; y: number; z: number; kills: number; deaths: number;
};

export function ggcard(g: gginfo) {
	const hp = `${(g.hp / 2).toFixed(1)} / ${Math.round(g.maxhp / 2)}`;
	return wrap(orange, [
		t(`## ⚔️ ${esc(g.by)}  vs  ${esc(g.who)}`),
		hr(),
		side(head(g.by), `### 🏆 ${esc(g.by)}\n**WINNER**  ·  ❤️ ${hp}\n🗡️ ${esc(g.wep)}\n🔪 Total kills: **${g.kills}**`),
		side(head(g.who), `### 💀 ${esc(g.who)}\n**ELIMINATED**\n☠️ Total deaths: **${g.deaths}**`),
		hr(),
		t(`> ${esc(g.msg)}`),
		t(`-# ${dimemoji(g.dim)} ${dimname(g.dim)}  ·  \`${g.x} ${g.y} ${g.z}\`  ·  ${when(Date.now())}`),
	]);
}

export type row = { ign: string; on: boolean; dim?: string; seen: number };

export function boardcards(rows: row[], others: string[], up: boolean) {
	const n = rows.filter((r) => r.on).length;
	let top = "## 🎮 Futile — Who's Online\n";
	top += up ? "🟢 World is **open**" : "⚫ World is **closed**";
	if (rows.length) top += `  ·  **${n}/${rows.length}** teammates on`;
	if (others.length) top += `\n👀 Also online: ${esc(others.join(", "))}`;
	if (!rows.length) top += "\n\nNo one is linked yet — use `/connect-discord-futile` to join the board!";

	const out: unknown[] = [wrap(up ? blurple : grey, [t(top), t(`-# Updated ${when(Date.now(), "R")}`)])];
	const extra: string[] = [];
	rows.forEach((r, i) => {
		if (i >= maxrows) {
			extra.push(`${r.on ? "🟡" : "🔴"} ${esc(r.ign)}`);
			return;
		}
		let s: string;
		if (r.on) s = `🟡 **${esc(r.ign)}** — online  ·  ${dimemoji(r.dim)} ${dimname(r.dim)}`;
		else if (r.seen > 0) s = `🔴 **${esc(r.ign)}** — offline  ·  last seen ${when(r.seen, "R")}`;
		else s = `🔴 **${esc(r.ign)}** — offline  ·  hasn't joined yet`;
		out.push(wrap(r.on ? yellow : red, [t(s)]));
	});
	if (extra.length) out.push(wrap(grey, [t(extra.join("\n"))]));
	return out;
}
