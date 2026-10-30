import { due } from "../lib/give.js";
import { json, wrap } from "../lib/guard.js";

export const GET = wrap(async () => json({ ok: true, ended: await due() }));
