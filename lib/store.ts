import { db, kv, pipe } from "./db.js";

const k = {
	links: "futile:links",
	owners: "futile:owners",
	kills: "futile:kills",
	deaths: "futile:deaths",
	seen: "futile:seen",
	ch: "futile:ch",
	ppl: "futile:ppl",
	up: "futile:up",
	boardid: "futile:board:id",
	boardhash: "futile:board:hash",
	cursor: "futile:cursor",
};

export type chkey = "chat" | "deaths" | "kills" | "active";
export type chans = Partial<Record<chkey, string>>;
export type dude = { name: string; dim: string };
export type link = { ign: string; dcname: string; at: number };

const lo = (s: string) => s.toLowerCase();
export const isflake = (s: unknown): s is string => typeof s === "string" && /^\d{15,21}$/.test(s);

export async function savech(ch: unknown) {
	if (!ch || typeof ch !== "object") return;
	const args: string[] = [];
	for (const key of ["chat", "deaths", "kills", "active"] as chkey[]) {
		const v = (ch as Record<string, unknown>)[key];
		if (isflake(v)) args.push(key, v);
	}
	if (args.length) await db("HSET", k.ch, ...args);
}

export const getch = async (): Promise<chans> => kv(await db("HGETALL", k.ch)) as chans;

export async function links(): Promise<Record<string, link>> {
	const raw = kv(await db("HGETALL", k.links));
	const o: Record<string, link> = {};
	for (const [id, j] of Object.entries(raw)) {
		try { o[id] = JSON.parse(j); } catch {}
	}
	return o;
}

export const owner = async (ign: string) => (await db<string | null>("HGET", k.owners, lo(ign))) ?? null;

export async function hook(id: string, dcname: string, ign: string) {
	const old = await db<string | null>("HGET", k.links, id);
	const cmds: (string | number)[][] = [];
	if (old) {
		try { cmds.push(["HDEL", k.owners, lo(JSON.parse(old).ign)]); } catch {}
	}
	const v: link = { ign, dcname, at: Date.now() };
	cmds.push(["HSET", k.links, id, JSON.stringify(v)], ["HSET", k.owners, lo(ign), id]);
	await pipe(cmds);
}

export async function unhook(id: string): Promise<link | null> {
	const old = await db<string | null>("HGET", k.links, id);
	if (!old) return null;
	const l = JSON.parse(old) as link;
	await pipe([["HDEL", k.links, id], ["HDEL", k.owners, lo(l.ign)]]);
	return l;
}

export const rip = async (ign: string) => Number(await db("HINCRBY", k.deaths, lo(ign), 1));
export const gg = async (ign: string) => Number(await db("HINCRBY", k.kills, lo(ign), 1));
export const deaths = async (ign: string) => Number((await db<string | null>("HGET", k.deaths, lo(ign))) ?? 0);

export async function seen(names: string[]) {
	if (!names.length) return;
	const rn = Date.now();
	await db("HSET", k.seen, ...names.flatMap((n) => [lo(n), rn]));
}

export async function lastseen(): Promise<Record<string, number>> {
	return Object.fromEntries(Object.entries(kv(await db("HGETALL", k.seen))).map(([a, b]) => [a, Number(b)]));
}

export async function ppl(): Promise<dude[]> {
	const raw = await db<string | null>("GET", k.ppl);
	try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export const setppl = (list: dude[], up: boolean) =>
	pipe([["SET", k.ppl, JSON.stringify(list)], ["SET", k.up, up ? "1" : "0"]]);

export const isup = async () => (await db<string | null>("GET", k.up)) === "1";

export const boardid = () => db<string | null>("GET", k.boardid);
export const setboardid = (id: string) => db("SET", k.boardid, id);
export const boardhash = () => db<string | null>("GET", k.boardhash);
export const setboardhash = (h: string) => db("SET", k.boardhash, h);
export const cursor = () => db<string | null>("GET", k.cursor);
export const setcursor = (id: string) => db("SET", k.cursor, id);
