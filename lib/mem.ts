const used = new Map<string, number>();
const bad = new Map<string, { n: number; till: number }>();
const hits = new Map<string, { n: number; min: number }>();

const maxbad = 8;
const maxhits = 300;
const cap = 5000;

function prune<v>(m: Map<string, v>, dead: (x: v) => boolean) {
	if (m.size < cap) return;
	for (const [k, x] of m) if (dead(x)) m.delete(k);
	if (m.size >= cap) m.clear();
}

export function fresh(nonce: string, ttl: number) {
	const rn = Date.now();
	prune(used, (t) => t < rn);
	const t = used.get(nonce);
	if (t && t > rn) return false;
	used.set(nonce, rn + ttl);
	return true;
}

export function sus(who: string) {
	const rn = Date.now();
	prune(bad, (x) => x.till < rn);
	const x = bad.get(who);
	const n = x && x.till > rn ? x.n + 1 : 1;
	bad.set(who, { n, till: rn + 15 * 60_000 });
}

export function banned(who: string) {
	const x = bad.get(who);
	return !!x && x.till > Date.now() && x.n >= maxbad;
}

export function spam(who: string) {
	const min = Math.floor(Date.now() / 60_000);
	prune(hits, (x) => x.min < min);
	const x = hits.get(who);
	const n = x && x.min === min ? x.n + 1 : 1;
	hits.set(who, { n, min });
	return n > maxhits;
}

const recent = new Map<string, number>();

export function dupe(key: string, ttl: number) {
	const rn = Date.now();
	prune(recent, (t) => t < rn);
	const t = recent.get(key);
	if (t && t > rn) return true;
	recent.set(key, rn + ttl);
	return false;
}
