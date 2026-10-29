import { boardcards, type row } from "./cards.js";
import { dcerr, drop, redo } from "./dc.js";
import * as st from "./store.js";

export async function board(force = false): Promise<string> {
	const ch = (await st.getch()).active;
	if (!ch) return "no active channel";

	const [ls, ppl, up, seen] = await Promise.all([st.links(), st.ppl(), st.isup(), st.lastseen()]);
	const on = new Map(ppl.map((p) => [p.name.toLowerCase(), p]));
	const team = new Set<string>();
	const rows: row[] = Object.values(ls).map((l) => {
		const key = l.ign.toLowerCase();
		team.add(key);
		const p = on.get(key);
		return { ign: l.ign, on: !!p, dim: p?.dim, seen: seen[key] ?? 0 };
	});
	rows.sort((a, b) => Number(b.on) - Number(a.on) || a.ign.localeCompare(b.ign, undefined, { sensitivity: "base" }));
	const others = ppl.filter((p) => !team.has(p.name.toLowerCase())).map((p) => p.name).sort();

	const hash = JSON.stringify({ ch, up, rows, others });
	if (!force && hash === (await st.boardhash())) return "same";

	const cards = boardcards(rows, others, up);
	const id = await st.boardid();
	if (id) {
		try {
			await redo(ch, id, cards);
			await st.setboardhash(hash);
			return "edited";
		} catch (err) {
			if (!(err instanceof dcerr && (err.code === 10008 || err.code === 50005 || err.status === 404))) throw err;
		}
	}
	const m = await drop(ch, cards);
	await Promise.all([st.setboardid(m.id), st.setboardhash(hash)]);
	return "posted";
}
