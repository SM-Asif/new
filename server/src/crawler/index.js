import axios from 'axios';
import { load } from 'cheerio';
import { URL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { db, now, log } from '../db/index.js';

const DEFAULT_HEADERS = {
  'User-Agent': 'NewsDomainHunter/1.0 (+https://localhost; contact: admin@localhost)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const NEWS_KEYWORDS = [
  'news', 'media', 'press', 'journal', 'times', 'post', 'herald', 'tribune',
  'gazette', 'chronicle', 'dispatch', 'bulletin', 'watch', 'report', 'daily',
  'weekly', 'hourly', 'breaking', 'headline', 'editorial', 'broadcast', 'tv',
  'radio', 'channel', 'network', 'wire', 'agency', 'reuters', 'bloomberg',
  'cnn', 'bbc', 'nytimes', 'guardian', 'telegraph', 'independent', 'mirror',
  'sun', 'express', 'star', 'mail', 'salem', 'fox', 'nbc', 'abc', 'cbs',
];

const INDUSTRY_TLDS = ['news', 'media', 'press', 'tv', 'radio', 'journal', 'magazine'];

function isLikelyNewsDomain(domain) {
  const d = domain.toLowerCase();
  if (INDUSTRY_TLDS.some(t => d.endsWith(`.${t}`))) return true;
  return NEWS_KEYWORDS.some(k => d.includes(k));
}

function domainOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

function normalizeUrl(url, base) {
  try {
    const resolved = new URL(url, base);
    resolved.hash = '';
    return resolved.href;
  } catch { return null; }
}

function sameDomain(a, b) {
  const da = domainOf(a);
  const db_ = domainOf(b);
  return da && db_ && da === db_;
}

function extractLinks(html, pageUrl) {
  const $ = load(html);
  const links = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const abs = normalizeUrl(href, pageUrl);
    if (!abs) return;
    const text = $(el).text().trim().slice(0, 300);
    const context = $(el).parent().text().trim().slice(0, 500);
    links.add({ url: abs, text, context });
  });
  // also extract canonical/og URLs as discovered hints
  return Array.from(links);
}

export async function parseSitemap(url) {
  const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 20000, maxRedirects: 5 });
  const xml = res.data;
  const urls = [];
  const $ = load(xml, { xmlMode: true });
  $('url loc, sitemap loc').each((_, el) => {
    const u = $(el).text().trim();
    if (u) urls.push(u);
  });
  return urls;
}

export async function parseFeed(url) {
  const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 20000, maxRedirects: 5 });
  const xml = res.data;
  const urls = [];
  const $ = load(xml, { xmlMode: true });
  $('link, url, entry > link, item > link').each((_, el) => {
    const href = $(el).attr('href') || $(el).text().trim();
    if (href) urls.push(href);
  });
  return urls;
}

async function fetchRobots(host) {
  try {
    const res = await axios.get(`https://${host}/robots.txt`, {
      headers: DEFAULT_HEADERS, timeout: 10000, maxRedirects: 3,
    });
    return res.data;
  } catch { return ''; }
}

function robotsAllows(robots, ua, url) {
  const uaLow = ua.toLowerCase();
  let currentUA = null;
  let disallow = [];
  let allow = [];
  const lines = robots.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [key, ...valParts] = line.split(':');
    const k = key.trim().toLowerCase();
    const v = valParts.join(':').trim();
    if (k === 'user-agent') {
      currentUA = v.toLowerCase();
      disallow = [];
      allow = [];
    } else if ((currentUA === '*' || currentUA === uaLow) && k === 'disallow') {
      disallow.push(v);
    } else if ((currentUA === '*' || currentUA === uaLow) && k === 'allow') {
      allow.push(v);
    }
  }
  const path = new URL(url).pathname;
  for (const a of allow) if (path.startsWith(a)) return true;
  for (const d of disallow) if (path.startsWith(d)) return false;
  return true;
}

async function fetchWithFallback(url, useJs, browser) {
  try {
    const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 30000, maxRedirects: 10, decompress: true });
    return { html: res.data, status: res.status, contentType: res.headers['content-type'] || '' };
  } catch (e) {
    if (useJs && browser) {
      try {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders(DEFAULT_HEADERS);
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const html = await page.content();
        const status = response ? response.status() : 200;
        await page.close();
        return { html, status, contentType: 'text/html' };
      } catch (e2) { return { html: '', status: 0, contentType: '', error: e2.message }; }
    }
    return { html: '', status: 0, contentType: '', error: e.message };
  }
}

export async function runCrawler(job, onEvent, stopSignal) {
  const { id: jobId, seedUrl, maxPages, maxDepth, concurrency, delayMs, respectRobots, useJs, countries, keywords, brands, tlds } = job;
  const seedHost = domainOf(seedUrl);
  if (!seedHost) throw new Error('Invalid seed URL');

  let robotsTxt = '';
  if (respectRobots) robotsTxt = await fetchRobots(seedHost);

  let browser = null;
  if (useJs) {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }

  const visited = new Set();
  const queue = [{ url: seedUrl, depth: 0 }];
  let pagesCrawled = 0;
  const domainsFound = new Map();

  const emit = (level, message) => {
    log({ jobId, level, message });
    onEvent?.({ type: 'log', level, message, jobId, timestamp: now() });
  };

  const limit = (await import('p-limit')).default(concurrency);

  emit('info', `Starting crawl of ${seedUrl} (max ${maxPages} pages, depth ${maxDepth})`);

  while (queue.length > 0 && pagesCrawled < maxPages) {
    if (stopSignal?.()) { emit('warn', 'Crawl stopped by user'); break; }

    const batch = queue.splice(0, concurrency);
    if (batch.length === 0) break;

    await Promise.all(batch.map((item) => limit(async () => {
      const { url, depth } = item;
      if (visited.has(url)) return;
      visited.add(url);
      if (stopSignal?.()) return;

      const d = domainOf(url);
      if (!d || d !== seedHost && depth > 0) {
        // only stay on seed domain for page crawling
        if (d !== seedHost) return;
      }

      if (respectRobots && !robotsAllows(robotsTxt, DEFAULT_HEADERS['User-Agent'], url)) return;

      await new Promise(r => setTimeout(r, delayMs));

      const result = await fetchWithFallback(url, useJs, browser);
      if (result.error || result.status === 0) {
        emit('warn', `Failed ${url}: ${result.error || 'no status'}`);
        return;
      }

      pagesCrawled++;
      db.run(`INSERT OR REPLACE INTO crawled_pages (id, job_id, url, status_code, title, content_type, fetched_at, links_found) VALUES (?,?,?,?,?,?,?,?)`, [(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('node:crypto').randomUUID(), jobId, url, result.status, null, result.contentType, now(), 0]);

      const html = result.html || '';
      const $ = load(html);
      const title = $('title').text().trim().slice(0, 300);
      db.run(`UPDATE crawled_pages SET title = ? WHERE url = ? AND job_id = ?`, [title, url, jobId]);

      const links = extractLinks(html, url);
      db.run(`UPDATE crawled_pages SET links_found = ? WHERE url = ? AND job_id = ?`, [links.length, url, jobId]);

      for (const link of links) {
        if (stopSignal?.()) break;
        const ld = domainOf(link.url);
        if (!ld) continue;

        // external link -> candidate domain
        if (ld !== seedHost) {
          const existing = domainsFound.get(ld);
          const entry = {
            domain: ld,
            url: link.url,
            page_url: url,
            link_text: link.text,
            link_context: link.context,
          };
          if (existing) {
            existing.seen_count += 1;
            existing.last_seen = now();
            existing.url = link.url;
            existing.page_url = url;
          } else {
            entry.first_seen = now();
            entry.last_seen = now();
            entry.seen_count = 1;
            domainsFound.set(ld, entry);
          }
          onEvent?.({ type: 'domain', domain: ld, ...entry, jobId, timestamp: now() });
        }

        // internal -> enqueue for deeper crawl
        if (ld === seedHost && depth < maxDepth) {
          queue.push({ url: link.url, depth: depth + 1 });
        }
      }

      onEvent?.({ type: 'progress', pagesCrawled, domainsFound: domainsFound.size, jobId, timestamp: now() });
    })));

    db.run(`UPDATE crawl_jobs SET pages_crawled = ?, domains_found = ?, updated_at = ? WHERE id = ?`, [pagesCrawled, domainsFound.size, now(), jobId]);
  }

  // persist discovered domains
  for (const [domain, entry] of domainsFound) {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('node:crypto').randomUUID();
    db.run(`INSERT OR IGNORE INTO discovered_domains (id, job_id, domain, url, page_url, link_text, link_context, first_seen, last_seen, seen_count) VALUES (?,?,?,?,?,?,?,?,?,?)`, [id, jobId, domain, entry.url, entry.page_url, entry.link_text, entry.link_context, entry.first_seen, entry.last_seen, entry.seen_count]);
  }

  db.run(`UPDATE crawl_jobs SET domains_found = ?, updated_at = ? WHERE id = ?`, [domainsFound.size, now(), jobId]);

  if (browser) await browser.close();
  emit('info', `Crawl finished. ${pagesCrawled} pages, ${domainsFound.size} candidate domains`);
  onEvent?.({ type: 'complete', pagesCrawled, domainsFound: domainsFound.size, jobId, timestamp: now() });
}
