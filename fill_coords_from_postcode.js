import fs from "fs";
import path from "path";

// Uses free UK postcode API
const API = "https://api.postcodes.io/postcodes/";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function lookup(postcode) {
  const pc = encodeURIComponent(postcode.trim());
  const res = await fetch(API + pc);
  if (!res.ok) return null;
  const json = await res.json();
  if (json.status !== 200 || !json.result) return null;
  return { lat: json.result.latitude, lon: json.result.longitude };
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map((line) => {
    // naive CSV split (works if your fields don’t contain commas)
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    return obj;
  });
  return { headers, rows };
}

function toCSV(headers, rows) {
  const out = [headers.join(",")];
  for (const r of rows) {
    out.push(headers.map((h) => (r[h] ?? "")).join(","));
  }
  return out.join("\n");
}

async function main() {
  const inFile = path.resolve("mosques_export.csv");
  const outFile = path.resolve("mosques_with_coords.csv");

  const raw = fs.readFileSync(inFile, "utf8");
  const { headers, rows } = parseCSV(raw);

  if (!headers.includes("latitude")) headers.push("latitude");
  if (!headers.includes("longitude")) headers.push("longitude");

  const pcField =
    headers.includes("postcode") ? "postcode" : headers.find((h) => h.toLowerCase().includes("postcode"));

  if (!pcField) {
    console.error("No postcode column found.");
    process.exit(1);
  }

  for (let i = 0; i < rows.length; i++) {
    const pc = (rows[i][pcField] || "").trim();
    if (!pc) continue;

    // skip if already set
    if (rows[i].latitude && rows[i].longitude) continue;

    const coords = await lookup(pc);
    if (coords) {
      rows[i].latitude = String(coords.lat);
      rows[i].longitude = String(coords.lon);
      console.log(`${i + 1}/${rows.length} ${pc} -> ${coords.lat}, ${coords.lon}`);
    } else {
      console.log(`${i + 1}/${rows.length} ${pc} -> NOT FOUND`);
    }

    // be polite to API
    await sleep(250);
  }

  fs.writeFileSync(outFile, toCSV(headers, rows), "utf8");
  console.log("\n✅ Done. Output:", outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
