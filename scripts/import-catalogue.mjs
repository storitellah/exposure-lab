/**
 * Update the camera or lens catalogue from a CSV or JSON file — no
 * application code changes required.
 *
 *   npm run import:catalogue -- cameras my-cameras.csv
 *   npm run import:catalogue -- lenses  my-lenses.json
 *   npm run import:catalogue -- cameras my-cameras.csv --merge
 *
 * Default behaviour replaces the catalogue's entries. With --merge, incoming
 * rows are matched on `id`: existing entries are updated, new ones appended.
 * The file is validated before anything is written, so a bad import leaves
 * the existing catalogue untouched.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = {
  cameras: {
    file: join(root, 'src', 'data', 'cameras.json'),
    key: 'cameras',
    required: ['id', 'manufacturer', 'model', 'mount', 'sensorWidthMm', 'sensorHeightMm', 'isoMin', 'isoMax'],
    numeric: [
      'sensorWidthMm', 'sensorHeightMm', 'cropFactor', 'resolutionMp', 'isoMin', 'isoMax',
      'isoExtMin', 'isoExtMax', 'baseIso', 'dualNativeIso', 'mechShutterMin', 'mechShutterMax',
      'eShutterMax', 'flashSync', 'drBaseStops',
    ],
    boolean: ['ibis'],
    list: ['photoModes', 'videoFps', 'videoRes', 'logProfiles'],
  },
  lenses: {
    file: join(root, 'src', 'data', 'lenses.json'),
    key: 'lenses',
    required: ['id', 'manufacturer', 'model', 'mount', 'minFocal', 'maxFocal', 'maxAperture'],
    numeric: ['minFocal', 'maxFocal', 'maxAperture', 'minAperture', 'tStop', 'minFocusM', 'anamorphicSqueeze'],
    boolean: ['stabilised', 'af', 'mf'],
    list: [],
  },
};

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function coerce(spec, header, raw) {
  const value = raw.trim();
  if (spec.numeric.includes(header)) {
    if (value === '' || value.toLowerCase() === 'null') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`"${header}" must be a number, got "${value}"`);
    return n;
  }
  if (spec.boolean.includes(header)) return /^(true|yes|1)$/i.test(value);
  if (spec.list.includes(header)) {
    if (value === '') return [];
    return value.split(/[;|]/).map((v) => v.trim()).filter(Boolean)
      .map((v) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v));
  }
  return value;
}

function rowsToEntries(spec, rows) {
  const [header, ...body] = rows;
  if (!header) throw new Error('CSV file has no header row');
  const headers = header.map((h) => h.trim());
  return body.map((cells, i) => {
    const entry = {};
    headers.forEach((h, col) => {
      if (!h) return;
      entry[h] = coerce(spec, h, cells[col] ?? '');
    });
    // Nested noise profile columns: noise.cleanIso / noise.strength
    if ('noise.cleanIso' in entry || 'noise.strength' in entry) {
      entry.noise = {
        cleanIso: Number(entry['noise.cleanIso'] ?? 1600),
        strength: Number(entry['noise.strength'] ?? 1),
      };
      delete entry['noise.cleanIso'];
      delete entry['noise.strength'];
    }
    for (const field of spec.required) {
      if (entry[field] === undefined || entry[field] === '' || entry[field] === null) {
        throw new Error(`row ${i + 2}: missing required field "${field}"`);
      }
    }
    return entry;
  });
}

function main() {
  const [target, inputPath, ...flags] = process.argv.slice(2);
  const spec = TARGETS[target];
  if (!spec || !inputPath) {
    console.error('Usage: npm run import:catalogue -- <cameras|lenses> <file.csv|file.json> [--merge]');
    process.exit(1);
  }
  const merge = flags.includes('--merge');
  const raw = readFileSync(inputPath, 'utf8');

  let incoming;
  if (inputPath.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(raw);
    incoming = Array.isArray(parsed) ? parsed : parsed[spec.key];
    if (!Array.isArray(incoming)) {
      throw new Error(`JSON must be an array, or an object with a "${spec.key}" array`);
    }
    for (const [i, entry] of incoming.entries()) {
      for (const field of spec.required) {
        if (entry[field] === undefined) throw new Error(`entry ${i}: missing required field "${field}"`);
      }
    }
  } else {
    incoming = rowsToEntries(spec, parseCsv(raw));
  }

  const ids = new Set();
  for (const entry of incoming) {
    if (ids.has(entry.id)) throw new Error(`duplicate id "${entry.id}" in import file`);
    ids.add(entry.id);
  }

  const catalogue = JSON.parse(readFileSync(spec.file, 'utf8'));
  if (merge) {
    const byId = new Map(catalogue[spec.key].map((e) => [e.id, e]));
    for (const entry of incoming) byId.set(entry.id, { ...byId.get(entry.id), ...entry });
    catalogue[spec.key] = [...byId.values()];
  } else {
    catalogue[spec.key] = incoming;
  }

  const today = new Date().toISOString().slice(0, 10);
  catalogue.updated = today;
  const [year, month] = today.split('-');
  const stamp = `${year}.${month}`;
  catalogue.catalogueVersion = catalogue.catalogueVersion?.startsWith(stamp)
    ? `${stamp}.${Number(catalogue.catalogueVersion.split('.')[2] ?? 0) + 1}`
    : `${stamp}.1`;

  writeFileSync(spec.file, `${JSON.stringify(catalogue, null, 2)}\n`);
  console.log(
    `Imported ${incoming.length} ${target} (${merge ? 'merged' : 'replaced'}) → ` +
    `${catalogue[spec.key].length} total, catalogue version ${catalogue.catalogueVersion}`,
  );
}

try {
  main();
} catch (err) {
  console.error(`Import failed — catalogue not modified.\n  ${err.message}`);
  process.exit(1);
}
