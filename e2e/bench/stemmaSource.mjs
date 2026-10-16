// Bench input: a number → deterministic synthetic stemma of that size; a path
// → a Stemma JSON file read at runtime (real data stays outside the repo).
import { readFileSync } from "node:fs";
import { syntheticStemma } from "./syntheticStemma.mjs";

export function loadStemma(spec) {
  if (/^\d+$/.test(String(spec))) return syntheticStemma(Number(spec));
  const s = JSON.parse(readFileSync(spec, "utf8"));
  if (!Array.isArray(s?.people) || !Array.isArray(s?.families)) throw new Error(`${spec}: not a Stemma`);
  return { type: "Stemma", people: s.people, families: s.families };
}

/** Routes the app's backend calls to an in-memory stemma (see renderBench.mjs). */
export async function mockBackend(context, getStemma) {
  await context.route("https://accounts.google.com/**", (r) => r.fulfill({ status: 200, body: "", contentType: "text/javascript" }));
  await context.route("http://bench.invalid/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
    const body = JSON.parse(req.postData() || "{}");
    const stemma = getStemma();
    let resp;
    if (body.type === "AuthLoginRequest") resp = { type: "AuthLoginResponse", userId: "u", email: "bench@local" };
    else if (body.type === "ListDescribeStemmasRequest")
      resp = { type: "OwnedStemmas", stemmas: [{ type: "StemmaDescription", id: "bench", name: "bench", removable: true }], firstStemma: stemma, favouriteStemmaId: null };
    else if (body.type === "GetStemmaRequest") resp = stemma;
    else resp = { type: "UnknownError", cause: "bench" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp) });
  });
}
