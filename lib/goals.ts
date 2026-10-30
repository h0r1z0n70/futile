import { blurple, esc, t, wrap } from "./cards.js";
import { drop, mine, recent, redo, textof } from "./dc.js";
import { env } from "./env.js";

type goal = { text: string; done: boolean };
const max = 50;
const room = 3600;

function parse(s: string): goal[] {
	const out: goal[] = [];
	for (const l of s.split("\n")) {
		const m = l.match(/^\d+\. (~~(.+)~~|(.+))$/);
		if (!m) continue;
		out.push(m[2] !== undefined ? { text: m[2], done: true } : { text: m[3], done: false });
	}
	return out;
}

const render = (gs: goal[]) => {
	const left = gs.filter((g) => !g.done).length;
	const body = gs.length
		? gs.map((g, i) => `${i + 1}. ${g.done ? `~~${g.text}~~` : g.text}`).join("\n")
		: "Nothing yet.";
	return [
		wrap(blurple, [
			t(`## Goals\n${body}`),
			t(`-# ${left} left, ${gs.length - left} done. Add one with /goal add. Mark one with /goal done.`),
		]),
	];
};

async function load() {
	const ch = env.goals;
	for (const m of await recent(ch, 50)) {
		if (!mine(m)) continue;
		const s = textof(m);
		if (s.startsWith("## Goals")) return { ch, id: m.id, gs: parse(s.split("\n").slice(1).join("\n")) };
	}
	return { ch, id: "", gs: [] as goal[] };
}

async function save(ch: string, id: string, gs: goal[]) {
	if (id) await redo(ch, id, render(gs));
	else await drop(ch, render(gs));
}

const size = (gs: goal[]) => gs.reduce((n, g) => n + g.text.length + 10, 0);

export async function goal(sub: string, os: any[]) {
	const v = (n: string) => os?.find((o: any) => o.name === n)?.value;
	const { ch, id, gs } = await load();
	const where = `<#${ch}>`;
	const num = Number(v("number") ?? 0);
	const pickone = () => (num >= 1 && num <= gs.length ? gs[num - 1] : null);

	switch (sub) {
		case "add": {
			const text = esc(String(v("text") ?? "").replace(/[\r\n]+/g, " ").trim()).slice(0, 150);
			if (!text) return "Write what we need.";
			if (gs.length >= max || size(gs) + text.length > room) return "The list is full. Remove or clear some goals first.";
			gs.push({ text, done: false });
			await save(ch, id, gs);
			return `Added goal ${gs.length} in ${where}.`;
		}
		case "done":
		case "undo": {
			const g = pickone();
			if (!g) return `There is no goal number ${num}.`;
			g.done = sub === "done";
			await save(ch, id, gs);
			return sub === "done" ? `Goal ${num} is done. Nice work.` : `Goal ${num} is open again.`;
		}
		case "remove": {
			if (!pickone()) return `There is no goal number ${num}.`;
			gs.splice(num - 1, 1);
			await save(ch, id, gs);
			return `Removed goal ${num}. The other goals moved up.`;
		}
		case "clear": {
			const left = gs.filter((g) => !g.done);
			const gone = gs.length - left.length;
			if (!gone) return "There are no finished goals to clear.";
			await save(ch, id, left);
			return `Cleared ${gone} finished goal${gone === 1 ? "" : "s"}.`;
		}
	}
	return "Unknown goal command.";
}
