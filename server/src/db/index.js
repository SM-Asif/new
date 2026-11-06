import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'hunter.db');
const WASM_PATH = path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

let SQL;
let _db;
let initialized = false;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  seed_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  max_pages INTEGER DEFAULT 10000,
  max_depth INTEGER DEFAULT 5,
  concurrency INTEGER DEFAULT 8,
  delay_ms INTEGER DEFAULT 200,
  respect_robots INTEGER DEFAULT 1,
  use_js INTEGER DEFAULT 0,
  countries TEXT DEFAULT '[]',
  keywords TEXT DEFAULT '[]',
  brands TEXT DEFAULT '[]',
  tlds TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  pages_crawled INTEGER DEFAULT 0,
  domains_found INTEGER DEFAULT 0,
  domains_available INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crawled_pages (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  title TEXT,
  content_type TEXT,
  fetched_at INTEGER NOT NULL,
  links_found INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS discovered_domains (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  page_url TEXT NOT NULL,
  link_text TEXT,
  link_context TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  seen_count INTEGER DEFAULT 1,
  available INTEGER DEFAULT 0,
  available_checked INTEGER DEFAULT 0,
  whois_created INTEGER,
  whois_expires INTEGER,
  whois_registrar TEXT,
  dns_a TEXT DEFAULT '[]',
  dns_mx TEXT DEFAULT '[]',
  dns_ns TEXT DEFAULT '[]',
  age_days INTEGER,
  authority_score REAL DEFAULT 0,
  keyword_match INTEGER DEFAULT 0,
  brand_match INTEGER DEFAULT 0,
  news_industry_score REAL DEFAULT 0,
  country TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS domain_history (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  available INTEGER NOT NULL,
  checked_at INTEGER NOT NULL,
  whois_created INTEGER,
  whois_expires INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crawl_logs (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

function randomId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : require('node:crypto').randomUUID();
}

const now = () => Date.now();

function save() {
  try {
    const data = _db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) { console.error('db save failed', e); }
}

function log({ jobId, level, message }) {
  const id = randomId();
  _run(`INSERT INTO crawl_logs (id, job_id, level, message, created_at) VALUES (?,?,?,?,?)`, [id, jobId || null, level, message, now()]);
}

async function init() {
  if (initialized) return;
  SQL = await initSqlJs({ locateFile: (f) => (f === 'sql-wasm.wasm' ? WASM_PATH : f) });
  let buffer;
  if (fs.existsSync(DB_PATH)) buffer = fs.readFileSync(DB_PATH);
  _db = new SQL.Database(buffer);
  _db.exec(SCHEMA);
  initialized = true;
}

function _run(sqlStr, params = []) {
  const stmt = _db.prepare(sqlStr);
  stmt.bind(params);
  stmt.run();
  stmt.reset();
  stmt.free();
  save();
  return { changes: 0 };
}

function _all(sqlStr, params = []) {
  const stmt = _db.prepare(sqlStr);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.reset();
  stmt.free();
  return rows;
}

function _get(sqlStr, params = []) {
  const stmt = _db.prepare(sqlStr);
  stmt.bind(params);
  let row = undefined;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.reset();
  stmt.free();
  return row;
}

function _exec(sqlStr) {
  _db.exec(sqlStr);
  save();
}

export const db = {
  run: (sqlStr, params = []) => _run(sqlStr, params),
  all: (sqlStr, params = []) => _all(sqlStr, params),
  get: (sqlStr, params = []) => _get(sqlStr, params),
  exec: (sqlStr) => _exec(sqlStr),
};

export { init, now, log, randomId, save };
