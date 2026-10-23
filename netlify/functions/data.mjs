import { getStore } from "@netlify/blobs";

const TEAMS = ["landmark", "housing", "green", "commerce", "traffic"];
const KEYS = [...TEAMS, "meta"];
const CLS = /^[1-3]-[1-3]$/;
const MAX = 4_000_000;

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function handle(req, store) {
  const u = new URL(req.url);
  const cls = u.searchParams.get("cls");
  const team = u.searchParams.get("team");
  if (!cls || !CLS.test(cls)) return json({ error: "bad class" }, 400);
  if (team && !KEYS.includes(team)) return json({ error: "bad team" }, 400);

  if (req.method === "GET") {
    if (team) return json((await store.get(`${cls}/${team}`, { type: "json" })) ?? null);
    const out = { meta: null, teams: {} };
    await Promise.all(
      KEYS.map(async (k) => {
        const v = (await store.get(`${cls}/${k}`, { type: "json" })) ?? null;
        if (k === "meta") out.meta = v;
        else out.teams[k] = v;
      })
    );
    return json(out);
  }

  if (req.method === "PUT") {
    if (!team) return json({ error: "team required" }, 400);
    const text = await req.text();
    if (text.length > MAX) return json({ error: "too large" }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "bad json" }, 400); }
    const key = `${cls}/${team}`;
    const cur = (await store.get(key, { type: "json" })) ?? null;
    const curV = cur?.version ?? 0;
    if (!body.force && (body.baseVersion ?? 0) !== curV) return json({ error: "conflict", current: cur }, 409);
    const rec = {
      data: body.data ?? null,
      version: curV + 1,
      savedAt: new Date().toISOString(),
      savedBy: String(body.savedBy || "").slice(0, 60),
    };
    await store.setJSON(key, rec);
    return json({ ok: true, version: rec.version, savedAt: rec.savedAt });
  }

  return json({ error: "method not allowed" }, 405);
}

export default async (req) => handle(req, getStore({ name: "city-planner", consistency: "strong" }));

export const config = { path: "/api/data" };
