import { json } from "../lib/guard.js";

export function GET() {
	return json({ ok: true, name: "futile", setup: "/api/setup" });
}
