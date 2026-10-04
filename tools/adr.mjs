#!/usr/bin/env node
// ADR index and constraints generator (ADR-0002).
//
//   node tools/adr.mjs generate   write adr/README.md and adr/CONSTRAINTS.md
//   node tools/adr.mjs check      validate ADRs; fail if generated files are stale
//
// Plain Node, no dependencies. The frontmatter parser reads only the YAML subset
// ADRs use (scalars, inline lists, block lists of scalars or flat maps) and
// fails loudly on anything else.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ADR_DIR = join(ROOT, 'adr');
const INDEX = join(ADR_DIR, 'README.md');
const CONSTRAINTS = join(ADR_DIR, 'CONSTRAINTS.md');

const STATES = ['proposed', 'approved', 'suspended', 'rejected', 'completed'];
const IN_FORCE = ['approved', 'completed'];
const TRANSITIONS = {
  proposed: ['approved', 'rejected', 'suspended'],
  approved: ['suspended', 'completed'],
  suspended: ['approved', 'proposed', 'rejected'],
  rejected: [],
  completed: [],
};
const REQUIRED = ['id', 'title', 'status', 'date', 'deciders', 'history'];
const LINKS = ['supersedes', 'amends', 'depends_on'];
const FILE_RE = /^(\d{4})-[a-z0-9-]+\.md$/;

// --- frontmatter parsing ---------------------------------------------------

function scalar(raw) {
  const v = raw.trim();
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"');
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

function inline(raw) {
  const v = raw.trim();
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) throw new Error(`unterminated list: ${v}`);
    const body = v.slice(1, -1).trim();
    return body ? body.split(',').map(scalar) : [];
  }
  return scalar(v);
}

function parseFrontmatter(text, file) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const lines = m[1].split('\n');
  const data = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const top = line.match(/^([a-z_]+):(?:\s+(.*))?$/);
    if (!top) throw new Error(`${file}: cannot parse line ${i + 2}: ${line}`);
    const [, key, rest] = top;
    i++;
    if (rest !== undefined && rest.trim() !== '') { data[key] = inline(rest); continue; }
    const items = [];
    while (i < lines.length && /^\s+/.test(lines[i])) {
      const l = lines[i];
      const item = l.match(/^ {2}- (.*)$/);
      const cont = l.match(/^ {4}([a-z_]+):\s+(.*)$/);
      if (item) {
        const kv = item[1].match(/^([a-z_]+):\s+(.*)$/);
        items.push(kv ? { [kv[1]]: scalar(kv[2]) } : scalar(item[1]));
      } else if (cont && items.length && typeof items.at(-1) === 'object') {
        items.at(-1)[cont[1]] = scalar(cont[2]);
      } else {
        throw new Error(`${file}: cannot parse line ${i + 2}: ${l}`);
      }
      i++;
    }
    data[key] = items;
  }
  return data;
}

// --- loading and validation ------------------------------------------------

function loadAdrs() {
  const files = readdirSync(ADR_DIR).filter((f) => /^\d{4}-.*\.md$/.test(f)).sort();
  return files.map((file) => ({ file, ...parseFrontmatter(readFileSync(join(ADR_DIR, file), 'utf8'), file) }));
}

function validate(adrs) {
  const errors = [];
  const ids = new Set(adrs.map((a) => a.id));
  const constraintIds = new Set();
  if (ids.size !== adrs.length) errors.push('duplicate ADR ids');

  for (const a of adrs) {
    const err = (msg) => errors.push(`${a.file}: ${msg}`);
    for (const k of REQUIRED) if (a[k] === undefined || a[k] === '') err(`missing ${k}`);

    const num = a.file.match(FILE_RE)?.[1];
    if (!num) err('file name must be NNNN-lowercase-slug.md');
    else if (a.id !== `ADR-${num}`) err(`id ${a.id} does not match file number ${num}`);

    if (!STATES.includes(a.status)) err(`unknown status "${a.status}"`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date ?? '')) err(`date must be YYYY-MM-DD`);

    for (const k of LINKS) {
      if (a[k] === undefined) continue;
      if (!Array.isArray(a[k])) { err(`${k} must be a list`); continue; }
      for (const ref of a[k]) {
        if (!ids.has(ref)) err(`${k} references unknown ${ref}`);
        if (ref === a.id) err(`${k} references itself`);
      }
    }

    const history = Array.isArray(a.history) ? a.history : [];
    if (!history.length) err('history is empty');
    history.forEach((h, n) => {
      for (const k of ['status', 'date', 'by', 'reason']) if (!h[k]) err(`history[${n}] missing ${k}`);
      if (n === 0 && h.status !== 'proposed') err('history must start with proposed');
      if (n > 0) {
        const from = history[n - 1].status;
        if (!TRANSITIONS[from]?.includes(h.status)) err(`history[${n}]: ${from} -> ${h.status} is not allowed`);
      }
      if (h.status === 'completed' && h.by !== 'system') err(`history[${n}]: only "system" may set completed`);
    });
    if (history.length && history.at(-1).status !== a.status) {
      err(`status "${a.status}" does not match last history entry "${history.at(-1).status}"`);
    }

    for (const c of a.constraints ?? []) {
      if (typeof c !== 'object' || !c.id || !c.rule) { err('each constraint needs id and rule'); continue; }
      if (!new RegExp(`^${a.id}\\.C\\d+$`).test(c.id)) err(`constraint id ${c.id} must be ${a.id}.Cn`);
      if (constraintIds.has(c.id)) err(`duplicate constraint id ${c.id}`);
      constraintIds.add(c.id);
    }
  }
  return errors;
}

// --- generation ------------------------------------------------------------

const HEADER = '<!-- Generated by tools/adr.mjs from ADR frontmatter. Do not edit by hand (ADR-0002). -->';

function supersededIds(adrs) {
  const out = new Set();
  for (const a of adrs) if (IN_FORCE.includes(a.status)) for (const s of a.supersedes ?? []) out.add(s);
  return out;
}

function renderIndex(adrs) {
  const superseded = supersededIds(adrs);
  const links = (a) => LINKS
    .filter((k) => a[k]?.length)
    .map((k) => `${k.replace('_', ' ')} ${a[k].join(', ')}`)
    .join('; ') || '—';
  const rows = adrs.map((a) => {
    const status = superseded.has(a.id) ? `${a.status} (superseded)` : a.status;
    return `| [${a.id}](${a.file}) | ${a.title} | ${status} | ${a.date} | ${links(a)} | ${(a.constraints ?? []).length} |`;
  });
  return [
    HEADER,
    '',
    '# Architecture Decision Records',
    '',
    'Every piece of work in this project starts from an approved ADR (ADR-0001).',
    'Constraints currently in force: [CONSTRAINTS.md](CONSTRAINTS.md).',
    '',
    '| ID | Title | Status | Date | Links | Constraints |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

function renderConstraints(adrs) {
  const superseded = supersededIds(adrs);
  const active = adrs.filter((a) => IN_FORCE.includes(a.status) && !superseded.has(a.id) && a.constraints?.length);
  const sections = active.flatMap((a) => [
    `## [${a.id}](${a.file}): ${a.title}`,
    '',
    ...a.constraints.map((c) => `- **${c.id}** ${c.rule}`),
    '',
  ]);
  return [
    HEADER,
    '',
    '# Constraints in force',
    '',
    'Rules from every approved or completed ADR that is not superseded.',
    'Follow them in all work. Each one links to the ADR that explains it.',
    '',
    ...(sections.length ? sections : ['None yet.', '']),
  ].join('\n');
}

// --- main ------------------------------------------------------------------

const cmd = process.argv[2];
if (!['generate', 'check'].includes(cmd)) {
  console.error('usage: node tools/adr.mjs generate|check');
  process.exit(2);
}

let adrs;
try {
  adrs = loadAdrs();
} catch (e) {
  console.error(`ADR parse error: ${e.message}`);
  process.exit(1);
}

const errors = validate(adrs);
if (errors.length) {
  console.error(`ADR validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}

const outputs = [[INDEX, renderIndex(adrs)], [CONSTRAINTS, renderConstraints(adrs)]];

if (cmd === 'generate') {
  for (const [path, text] of outputs) writeFileSync(path, text);
  console.log(`Generated adr/README.md and adr/CONSTRAINTS.md from ${adrs.length} ADRs.`);
} else {
  const stale = outputs
    .filter(([path, text]) => !existsSync(path) || readFileSync(path, 'utf8') !== text)
    .map(([path]) => path.slice(ROOT.length + 1));
  if (stale.length) {
    console.error(`Out of date: ${stale.join(', ')}. Run: node tools/adr.mjs generate`);
    process.exit(1);
  }
  console.log(`OK: ${adrs.length} ADRs valid, generated files up to date.`);
}
