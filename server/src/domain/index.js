import whois from 'node-whois';
import dns from 'node:dns/promises';
import { URL } from 'node:url';
import { db, now, log } from '../db/index.js';

const NEWS_KEYWORDS = [
  'news', 'media', 'press', 'journal', 'times', 'post', 'herald', 'tribune',
  'gazette', 'chronicle', 'dispatch', 'bulletin', 'watch', 'report', 'daily',
  'weekly', 'hourly', 'breaking', 'headline', 'editorial', 'broadcast', 'tv',
  'radio', 'channel', 'network', 'wire', 'agency', 'magazine',
];

const INDUSTRY_TLDS = ['news', 'media', 'press', 'tv', 'radio', 'journal', 'magazine', 'co', 'com', 'net', 'org'];

const COUNTRY_TLDS = {
  us: 'us', uk: 'uk', ca: 'ca', au: 'au', in: 'in', nz: 'nz', ie: 'ie', za: 'za',
  ng: 'ng', ke: 'ke', gh: 'gh', jp: 'jp', kr: 'kr', sg: 'sg', ph: 'ph', my: 'my',
  br: 'br', mx: 'mx', ar: 'ar', cl: 'cl', co: 'co', pe: 'pe', fr: 'fr', de: 'de',
  es: 'es', it: 'it', nl: 'nl', se: 'se', no: 'no', dk: 'dk', fi: 'fi', pl: 'pl',
  ru: 'ru', tr: 'tr', ae: 'ae', sa: 'sa', eg: 'eg', in: 'in', pk: 'pk', bd: 'bd',
};

function domainOnly(input) {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  return d;
}

function tldOf(domain) {
  const parts = domain.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function keywordScore(domain, keywords) {
  const d = domain.toLowerCase();
  let score = 0;
  let matches = 0;
  for (const k of (keywords || [])) {
    if (!k) continue;
    if (d.includes(k.toLowerCase())) { score += 25; matches++; }
  }
  if (INDUSTRY_TLDS.some(t => d.endsWith(`.${t}`))) { score += 15; matches++; }
  if (/\b(news|media|press|journal|times|post|daily|weekly|report|broadcast|wire|agency)\b/.test(d)) { score += 10; matches++; }
  return { score: Math.min(score, 100), matches };
}

function brandScore(domain, brands) {
  const d = domain.toLowerCase();
  let score = 0;
  let matches = 0;
  for (const b of (brands || [])) {
    if (!b) continue;
    if (d.includes(b.toLowerCase())) { score += 40; matches++; }
  }
  return { score: Math.min(score, 100), matches };
}

function countryScore(domain, countries) {
  if (!countries || countries.length === 0) return { score: 50, matches: 0 };
  const t = tldOf(domain);
  let score = 0;
  let matches = 0;
  for (const c of countries) {
    const ct = String(c).toLowerCase();
    const expected = COUNTRY_TLDS[ct] || ct;
    if (t === expected) { score += 30; matches++; }
  }
  return { score: Math.min(score, 100), matches };
}

export async function whoisLookup(domain) {
  try {
    const data = await new Promise((resolve, reject) => {
      whois.lookup(domain, (err, data) => err ? reject(err) : resolve(data));
    });
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const created = parseWhoisDate(text, ['created', 'creation', 'registered', 'registered-on', 'created-on']);
    const expires = parseWhoisDate(text, ['expires', 'expiry', 'expiration', 'expires-on', 'registry-expiry']);
    const registrar = parseWhoisField(text, ['registrar']);
    const available = isAvailableWhois(text);
    return { available, created, expires, registrar, raw: text.slice(0, 3000) };
  } catch (e) {
    // WHOIS error often means available or unparsable
    return { available: null, created: null, expires: null, registrar: null, raw: '', error: e.message };
  }
}

function parseWhoisDate(text, keys) {
  const lines = text.split(/\r?\n/);
  for (const key of keys) {
    const re = new RegExp(`^${key}[\\s:.]*(.+)$`, 'im');
    for (const line of lines) {
      const m = line.match(re);
      if (m) {
        const dt = new Date(m[1].trim());
        if (!isNaN(dt.getTime())) return dt.getTime();
      }
    }
  }
  return null;
}

function parseWhoisField(text, keys) {
  const lines = text.split(/\r?\n/);
  for (const key of keys) {
    const re = new RegExp(`^${key}[\\s:.]*(.+)$`, 'im');
    for (const line of lines) {
      const m = line.match(re);
      if (m) return m[1].trim();
    }
  }
  return null;
}

function isAvailableWhois(text) {
  const t = text.toLowerCase();
  const noMatch = [
    'no match', 'not found', 'no entries found', 'no entries found for',
    'status: available', 'available', 'domain not found', 'no data found',
    'not registered', 'no such domain', 'queried object does not exist',
    'object does not exist', 'status: free',
  ];
  const taken = [
    'registered', 'registered until', 'expires on', 'expiry date',
    'registrar:', 'name server:', 'nserver:', 'status: clienthold',
    'status: clientdeleteprohibited', 'status: active',
  ];
  if (noMatch.some(k => t.includes(k))) return true;
  if (taken.some(k => t.includes(k))) return false;
  return null;
}

export async function dnsRecords(domain) {
  const records = { a: [], mx: [], ns: [] };
  try { records.a = (await dns.resolve4(domain)).map(r => r.address); } catch { /* no A */ }
  try { records.mx = (await dns.resolveMx(domain)).map(r => r.exchange); } catch { /* no MX */ }
  try { records.ns = (await dns.resolveNs(domain)).map(r => r.address || r.nsdname); } catch { /* no NS */ }
  return records;
}

export async function httpProbe(domain) {
  for (const scheme of ['http', 'https']) {
    try {
      const res = await fetch(`${scheme}://${domain}`, { method: 'HEAD', signal: AbortSignal.timeout(8000), redirect: 'manual' });
      if (res.status < 400 || res.status === 401 || res.status === 403) return { live: true, status: res.status, scheme };
    } catch {
      try {
        const res = await fetch(`${scheme}://${domain}`, { method: 'GET', signal: AbortSignal.timeout(8000), redirect: 'manual' });
        if (res.status < 400) return { live: true, status: res.status, scheme };
      } catch { /* */ }
    }
  }
  return { live: false };
}

export async function checkDomain(domain) {
  const d = domainOnly(domain);
  const whoisRes = await whoisLookup(d);
  const dnsRes = await dnsRecords(d);
  const httpRes = await httpProbe(d);

  let available = whoisRes.available;
  if (available === null) available = !httpRes.live && dnsRes.a.length === 0 && dnsRes.mx.length === 0 && dnsRes.ns.length === 0;

  const ageDays = whoisRes.created ? Math.floor((Date.now() - whoisRes.created) / 86400000) : null;

  return {
    domain: d,
    available: !!available,
    whois_created: whoisRes.created,
    whois_expires: whoisRes.expires,
    whois_registrar: whoisRes.registrar,
    dns_a: dnsRes.a,
    dns_mx: dnsRes.mx,
    dns_ns: dnsRes.ns,
    age_days: ageDays,
    http_live: httpRes.live,
    http_status: httpRes.status,
    http_scheme: httpRes.scheme,
    raw_whois: whoisRes.raw,
  };
}

function computeScores({ domain, seenCount, ageDays, available, countries, keywords, brands }) {
  const k = keywordScore(domain, keywords);
  const b = brandScore(domain, brands);
  const c = countryScore(domain, countries);

  let authority = 0;
  authority += Math.min(seenCount * 2, 40);
  if (ageDays) authority += Math.min(Math.floor(ageDays / 365) * 10, 30);
  if (available) authority += 20;
  authority += Math.min(k.score, 15);
  authority += Math.min(b.score, 15);

  const newsIndustry = Math.min(k.score + b.score + c.score + (available ? 10 : 0), 100);

  return {
    authority_score: Math.round(Math.min(authority, 100) * 100) / 100,
    keyword_match: k.matches,
    brand_match: b.matches,
    country_score: c.score,
    news_industry_score: Math.round(Math.min(newsIndustry, 100) * 100) / 100,
  };
}

export async function evaluateDomain(domainId, domain, seenCount, countries, keywords, brands) {
  const check = await checkDomain(domain);
  const scores = computeScores({
    domain, seenCount, ageDays: check.age_days, available: check.available,
    countries, keywords, brands,
  });

  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('node:crypto').randomUUID();
  db.run(`INSERT OR REPLACE INTO discovered_domains (id, domain, available, available_checked, whois_created, whois_expires, whois_registrar, dns_a, dns_mx, dns_ns, age_days, authority_score, keyword_match, brand_match, news_industry_score, status, url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [domainId, domain, check.available ? 1 : 0, 1, check.whois_created, check.whois_expires, check.whois_registrar,
    JSON.stringify(check.dns_a), JSON.stringify(check.dns_mx), JSON.stringify(check.dns_ns),
    check.age_days, scores.authority_score, scores.keyword_match, scores.brand_match, scores.news_industry_score,
    check.available ? 'available' : 'taken', `https://${domain}`]);

  db.run(`INSERT INTO domain_history (id, domain_id, available, checked_at, whois_created, whois_expires, notes) VALUES (?,?,?,?,?,?,?)`, [(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('node:crypto').randomUUID(), domainId, check.available ? 1 : 0, now(), check.whois_created, check.whois_expires, check.available ? 'Available to register' : 'Taken']);

  log({ level: 'info', message: `Domain ${domain} ${check.available ? 'AVAILABLE' : 'taken'} (score ${scores.authority_score})` });

  return { ...check, ...scores };
}

export async function evaluatePendingDomains(jobId, countries, keywords, brands, concurrency = 4, stopSignal) {
  const pending = db.all(`SELECT id, domain, seen_count FROM discovered_domains WHERE job_id = ? AND available_checked = 0 ORDER BY seen_count DESC`, [jobId]);
  const limit = (await import('p-limit')).default(concurrency);
  const results = [];
  for (const row of pending) {
    if (stopSignal?.()) break;
    await limit(async () => {
      try {
        const r = await evaluateDomain(row.id, row.domain, row.seen_count, countries, keywords, brands);
        results.push({ domain: row.domain, ...r });
      } catch (e) {
        log({ level: 'error', message: `Eval failed ${row.domain}: ${e.message}` });
      }
    });
  }
  return results;
}
