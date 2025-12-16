#!/usr/bin/env node
/**
 * Dump a run+BAC drilldown payload as JSON.
 *
 * Usage:
 *   node scripts/inspect-bac.mjs --bac <bac> [--run <runId>] [--base http://localhost:3000] [--pretty] [--out file.json]
 */

function parseArgs(argv) {
  const args = { base: "http://localhost:3000", pretty: false, out: null, run: null, bac: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pretty") args.pretty = true;
    else if (a === "--base") args.base = argv[++i] ?? args.base;
    else if (a === "--out") args.out = argv[++i] ?? null;
    else if (a === "--run") args.run = argv[++i] ?? null;
    else if (a === "--bac") args.bac = argv[++i] ?? null;
    else if (a === "-h" || a === "--help") return { ...args, help: true };
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.bac) {
  console.error(
    [
      "Usage:",
      "  node scripts/inspect-bac.mjs --bac <bac> [--run <runId>] [--base http://localhost:3000] [--pretty] [--out file.json]",
      "",
      "Examples:",
      "  node scripts/inspect-bac.mjs --bac 111153 --pretty",
      "  node scripts/inspect-bac.mjs --bac 111153 --out /tmp/bac-111153.json",
      "  node scripts/inspect-bac.mjs --run clx123 --bac 111153 --pretty",
    ].join("\n"),
  );
  process.exit(args.help ? 0 : 2);
}

async function resolveRunId({ base, run }) {
  if (run) return run;

  const listUrl = new URL(`/api/runs`, base).toString();
  const listRes = await fetch(listUrl, { headers: { accept: "application/json" } });
  const listText = await listRes.text();
  if (!listRes.ok) {
    console.error(`Request failed (${listRes.status}) ${listUrl}`);
    console.error(listText);
    process.exit(1);
  }

  let runs;
  try {
    runs = JSON.parse(listText);
  } catch {
    console.error("Response was not valid JSON:");
    console.error(listText);
    process.exit(1);
  }

  const latest = Array.isArray(runs) ? runs[0] : null;
  if (!latest?.id) {
    console.error("No runs found when resolving latest run.");
    process.exit(1);
  }
  return latest.id;
}

const runId = await resolveRunId(args);
const url = new URL(`/api/runs/${encodeURIComponent(runId)}/bacs/${encodeURIComponent(args.bac)}`, args.base).toString();
const res = await fetch(url, { headers: { accept: "application/json" } });
const text = await res.text();
if (!res.ok) {
  console.error(`Request failed (${res.status}) ${url}`);
  console.error(text);
  process.exit(1);
}

let json;
try {
  json = JSON.parse(text);
} catch {
  console.error("Response was not valid JSON:");
  console.error(text);
  process.exit(1);
}

const out = args.pretty ? JSON.stringify(json, null, 2) : JSON.stringify(json);

if (args.out) {
  const fs = await import("node:fs/promises");
  await fs.writeFile(args.out, out, "utf8");
  console.error(`Wrote ${args.out}`);
} else {
  process.stdout.write(out + "\n");
}



