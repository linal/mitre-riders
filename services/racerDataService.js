const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

// Debug function to save page content when running locally
function saveDebugPageContent(log, url, html, person_id, discipline, requestType = 'unknown') {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  try {
    const debugDir = path.join(__dirname, '..', 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const disciplinePrefix = discipline === 'both' ? 'all' : discipline;
    const baseFilename = `bc_page_${disciplinePrefix}_${requestType}_${person_id}_${timestamp}`;
    const jsonFilepath = path.join(debugDir, `${baseFilename}.json`);
    const htmlFilepath = path.join(debugDir, `${baseFilename}.html`);

    const debugData = {
      timestamp: new Date().toISOString(),
      person_id: person_id,
      discipline: discipline,
      request_type: requestType,
      url: url,
      html_length: html ? html.length : 0,
      html_preview: html ? html.substring(0, 1000) : null,
      full_html: html
    };

    fs.writeFileSync(jsonFilepath, JSON.stringify(debugData, null, 2), 'utf8');
    log.debug('debug_page_saved', { path: jsonFilepath, request_type: requestType });

    if (html) {
      fs.writeFileSync(htmlFilepath, html, 'utf8');
      log.debug('debug_html_saved', { path: htmlFilepath, request_type: requestType });
    }
  } catch (err) {
    log.error('debug_page_save_error', { err });
  }
}

// Helper function to process regular points from HTML
function processRegularPoints(html, log = logger) {
  let raceCount = 0;
  let totalPoints = 0;
  let regionalPoints = 0;
  let nationalPoints = 0;

  // Diagnostic counters - we surface these on the final summary so any
  // mismatch between rows-found and points-classified is immediately
  // visible without enabling debug-level logging.
  let rowsParsed = 0;
  let rowsWithFewCells = 0;
  let rowsClassified = 0;

  const tbodyStart = html.indexOf('<tbody>');
  const tbodyEnd = html.indexOf('</tbody>');
  const tbodyFound = tbodyStart !== -1 && tbodyEnd !== -1;
  log.debug('process_regular_tbody', {
    tbody_found: tbodyFound,
    tbody_start: tbodyStart,
    tbody_end: tbodyEnd,
  });

  if (!tbodyFound && html.length > 50000) {
    // A real BC points page is ~430KB and always has a tbody; a missing
    // tbody on a real-size page means the layout changed.
    log.warn('process_regular_no_tbody', {
      html_length: html.length,
      hint: 'page is full-size but contains no <tbody> - markup may have changed',
    });
  }

  // Capture which event-id pattern actually produced matches so the log
  // tells us which BC URL shape is currently in use.
  let eventIdPatternUsed = null;
  let tbodySnapshot = '';
  if (tbodyFound) {
    const tbody = html.slice(tbodyStart, tbodyEnd);
    tbodySnapshot = tbody;

    // Try multiple patterns - BC has historically used
    // /events/details/<id>/ but newer markup uses /events/<id>/<slug>/.
    // Whichever returns matches first wins.
    const eventIdPatterns = [
      { name: 'events_details_id', re: /\/events\/details\/(\d+)\//g },
      { name: 'events_id', re: /\/events\/(\d+)(?:\/|\b)/g },
    ];
    let eventIdMatches = [];
    for (const pat of eventIdPatterns) {
      const matches = [...tbody.matchAll(pat.re)];
      if (matches.length > 0) {
        eventIdMatches = matches;
        eventIdPatternUsed = pat.name;
        break;
      }
    }
    const uniqueEventIds = new Set(eventIdMatches.map(match => match[1]));
    raceCount = uniqueEventIds.size;
    log.debug('process_regular_events', {
      event_matches: eventIdMatches.length,
      unique_races: raceCount,
      pattern_used: eventIdPatternUsed,
    });

    const rows = tbody.split(/<tr\b[^>]*>/);
    rowsParsed = Math.max(0, rows.length - 1);
    log.debug('process_regular_rows', { row_count: rowsParsed });
    // Permissive cell split: handles <td>, <td class="..">, <td colspan="..">,
    // and any other attribute-bearing variant the BC site might emit.
    const cellSplitter = /<td\b[^>]*>/;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.split(cellSplitter);

      if (cells.length >= 6) {
        const categoryCell = cells[2];
        const pointsCell = cells[5];
        const pointsEndIndex = pointsCell.indexOf('</td>');
        if (pointsEndIndex !== -1) {
          const pointsValue = pointsCell.substring(0, pointsEndIndex).trim();
          const points = isNaN(Number(pointsValue)) ? 0 : Number(pointsValue);

          if (categoryCell.includes('National')) {
            nationalPoints += points;
          } else {
            regionalPoints += points;
          }
          rowsClassified++;
        }
      } else {
        rowsWithFewCells++;
      }
    }

    // If the URL-pattern probes failed but we DID classify rows, treat each
    // valid data row as a race. More robust to URL format churn than the
    // event-id regex alone.
    if (raceCount === 0 && rowsClassified > 0) {
      raceCount = rowsClassified;
      eventIdPatternUsed = 'row_count_fallback';
    }
  }

  const tfootStart = html.indexOf('<tfoot>');
  log.debug('process_regular_tfoot', { tfoot_found: tfootStart !== -1 });
  if (tfootStart !== -1) {
    // Same permissive treatment for tfoot - the total cell may also carry
    // attributes (e.g. <td class="total">).
    let pos = html.indexOf('<td', tfootStart);
    for (let i = 0; i < 4 && pos !== -1; i++) {
      pos = html.indexOf('<td', pos + 1);
    }
    if (pos !== -1) {
      const tagEnd = html.indexOf('>', pos);
      const start = tagEnd === -1 ? pos + 4 : tagEnd + 1;
      const end = html.indexOf('</td>', start);
      const value = html.slice(start, end).trim();
      totalPoints = isNaN(Number(value)) ? 0 : Number(value);
      log.debug('process_regular_total', { raw_value: value, parsed: totalPoints });
    }
  }

  // Internal consistency checks. These catch silent HTML-layout regressions
  // where the page parses fine and the tfoot total comes out, but per-row
  // extraction returns nothing.
  if (totalPoints > 0 && raceCount === 0) {
    log.warn('process_regular_total_without_races', {
      total_points: totalPoints,
      race_count: raceCount,
      tbody_length: tbodyFound ? tbodyEnd - tbodyStart : 0,
      hint: 'tfoot reports points but tbody yielded no event ids - regex /events/details/<id>/ may be stale',
    });
  }
  if (totalPoints > 0 && regionalPoints + nationalPoints === 0) {
    log.warn('process_regular_unclassified_points', {
      total_points: totalPoints,
      regional_points: regionalPoints,
      national_points: nationalPoints,
      rows_parsed: rowsParsed,
      rows_with_few_cells: rowsWithFewCells,
      rows_classified: rowsClassified,
      hint: 'tfoot total > 0 but no row was classified - <td> split likely needs to handle <td class="...">',
    });
  }
  if (rowsParsed > 0 && rowsClassified === 0) {
    log.warn('process_regular_no_rows_classified', {
      rows_parsed: rowsParsed,
      rows_with_few_cells: rowsWithFewCells,
      hint: 'rows present in tbody but none had >=6 <td> cells - markup may use attributes on <td>',
    });
  }

  // Aggregate parse diagnostics. We pass these back to the caller so the
  // server-side cache_attempt_summary can include them on the same line as
  // the extracted values - an LLM reading the summary then has the full
  // context for "why does this rider have suspicious-looking data?" without
  // needing to correlate separate log lines.
  const parseDiagnostics = {
    tbody_found: tbodyFound,
    tbody_length: tbodyFound ? tbodyEnd - tbodyStart : 0,
    rows_parsed: rowsParsed,
    rows_classified: rowsClassified,
    rows_with_few_cells: rowsWithFewCells,
    event_id_pattern_used: eventIdPatternUsed,
    warnings: [],
  };
  if (!tbodyFound && html.length > 50000) parseDiagnostics.warnings.push('no_tbody_on_full_page');
  if (totalPoints > 0 && raceCount === 0) parseDiagnostics.warnings.push('total_without_races');
  if (totalPoints > 0 && regionalPoints + nationalPoints === 0) parseDiagnostics.warnings.push('unclassified_points');
  if (rowsParsed > 0 && rowsClassified === 0) parseDiagnostics.warnings.push('no_rows_classified');

  // When the parser fires warnings, dump a truncated sample of the actual
  // tbody markup into the log so a future LLM/human can derive the new
  // regex from the log alone - no need to retrieve a debug HTML file off
  // the server. Capped to keep log lines manageable; we also snapshot a
  // single representative row when possible.
  if (parseDiagnostics.warnings.length > 0 && tbodyFound) {
    const SAMPLE_CAP = 4000;
    const tbodyTruncated = parseDiagnostics.tbody_length > SAMPLE_CAP;
    const tbodySample = tbodySnapshot.slice(0, SAMPLE_CAP);

    // Pull the first <tr>...</tr> we can find as a representative row -
    // usually enough to see the new <td class="..."> shape and the link
    // format used for events.
    let rowSample = null;
    const trMatch = tbodySnapshot.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/);
    if (trMatch) {
      rowSample = trMatch[0].slice(0, 1500);
    }

    log.warn('process_regular_html_sample', {
      description:
        'Parse warnings fired; logging a tbody sample so the regexes can be ' +
        'updated from the log alone. Examine `row_sample` for the current ' +
        '<td>/<a> markup shape.',
      parse_warnings: parseDiagnostics.warnings,
      tbody_length: parseDiagnostics.tbody_length,
      tbody_sample_truncated: tbodyTruncated,
      tbody_sample: tbodySample,
      row_sample: rowSample,
    });
  }

  log.info('process_regular_done', {
    races: raceCount,
    total_points: totalPoints,
    regional_points: regionalPoints,
    national_points: nationalPoints,
    rows_parsed: rowsParsed,
    rows_classified: rowsClassified,
    rows_with_few_cells: rowsWithFewCells,
    event_id_pattern_used: eventIdPatternUsed,
    parse_warnings: parseDiagnostics.warnings,
  });
  return {
    raceCount,
    totalPoints,
    regionalPoints,
    nationalPoints,
    parseDiagnostics,
  };
}

// Helper function to process cyclocross points from HTML
function processCyclocrossPoints(_html) {
  // Cyclocross disabled
  return { raceCount: 0, totalPoints: 0, regionalPoints: 0, nationalPoints: 0 };
}

// Detect a real Cloudflare interstitial. We deliberately avoid loose
// substring checks like html.includes('cloudflare') because the real
// British Cycling page legitimately references Cloudflare-hosted assets
// and third-party domains, which would cause false positives.
function isCloudflareChallenge(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  if (/^Just a moment/i.test(title)) return true;
  if (/^Attention Required/i.test(title)) return true;
  if (html.includes('id="challenge-form"')) return true;
  if (html.includes('cf-browser-verification')) return true;
  if (html.includes('cf-challenge-running')) return true;
  if (html.includes('window._cf_chl_opt')) return true;
  if (html.includes('Checking your browser before accessing')) return true;
  return false;
}

// Resolve Chrome/Edge executable cross-platform. If not found, fall back
// to Puppeteer's bundled Chromium.
function resolveChromeExecutable() {
  if (process.env.CHROME_EXECUTABLE && fs.existsSync(process.env.CHROME_EXECUTABLE)) {
    return process.env.CHROME_EXECUTABLE;
  }

  const platform = process.platform;
  if (platform === 'linux') {
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  if (platform === 'win32') {
    const candidates = [];
    const programFiles = process.env['PROGRAMFILES'];
    const programFilesX86 = process.env['PROGRAMFILES(X86)'];
    const localAppData = process.env['LOCALAPPDATA'];
    if (programFiles) {
      candidates.push(path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
    if (programFilesX86) {
      candidates.push(path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
    if (localAppData) {
      candidates.push(path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  if (platform === 'darwin') {
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
    for (const p of macPaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  return null;
}

// Main service function to fetch and process racer data
async function fetchRacerData(person_id, year, clubsFile, discipline = 'both') {
  const startTime = Date.now();
  const log = logger.child({
    component: 'puppeteer',
    person_id,
    year,
    discipline,
  });

  log.info('fetch_start', {
    timestamp: new Date().toISOString(),
  });

  const launchStart = Date.now();
  log.info('puppeteer_launch', {
    timeout_ms: 300000,
    protocol_timeout_ms: 300000,
  });

  let browser;
  let foundChrome = null;

  try {
    log.debug('puppeteer_env', {
      node_env: process.env.NODE_ENV,
      platform: process.platform,
    });

    foundChrome = resolveChromeExecutable();
    if (foundChrome) {
      log.info('chrome_executable_found', { path: foundChrome });
    } else {
      log.info('chrome_not_found', { fallback: 'puppeteer_bundled_chromium' });
    }

    const launchOptions = {
      headless: 'new',
      timeout: 30000,
      protocolTimeout: 30000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI,VizDisplayCompositor',
        '--disable-ipc-flooding-protection',
        '--disable-breakpad',
        '--no-first-run',
        '--no-default-browser-check',
        '--js-flags=--max-old-space-size=384',
        '--window-size=1280,720',
      ],
    };
    if (foundChrome) {
      launchOptions.executablePath = foundChrome;
    }

    browser = await Promise.race([
      puppeteer.launch(launchOptions),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Browser launch timeout after 30s')), 30000)
      ),
    ]);
  } catch (err) {
    const launchDuration = Date.now() - launchStart;
    const memInfo = process.memoryUsage();
    log.error('puppeteer_launch_failed', {
      duration_ms: launchDuration,
      err,
      memory: {
        heap_mb: +(memInfo.heapUsed / 1024 / 1024).toFixed(1),
        rss_mb: +(memInfo.rss / 1024 / 1024).toFixed(1),
        external_mb: +(memInfo.external / 1024 / 1024).toFixed(1),
      },
      system: {
        uptime_s: process.uptime(),
        platform: process.platform,
        arch: process.arch,
      },
    });

    // Best-effort: check whether Chrome processes are running on the host.
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        const processes = execSync('tasklist | findstr /I "chrome msedge chromium"', { encoding: 'utf8' });
        log.debug('chrome_processes_win', {
          line_count: processes.split('\n').filter(Boolean).length,
        });
      } else {
        const processes = execSync('ps aux | grep -E "(chrome|chromium|msedge)" || true', { encoding: 'utf8' });
        log.debug('chrome_processes_unix', {
          process_count: processes.split('\n').length - 1,
        });
      }
    } catch (psErr) {
      log.debug('process_check_failed', { err: psErr });
    }

    throw new Error(`Browser launch failed: ${err.message}`);
  }

  const launchDuration = Date.now() - launchStart;
  log.info('puppeteer_launched', { duration_ms: launchDuration });

  const pageStart = Date.now();
  const page = await browser.newPage();
  const pageDuration = Date.now() - pageStart;
  log.info('puppeteer_page_created', { duration_ms: pageDuration });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });

  try {
    log.info('puppeteer_fetch_start');

    const regularUrl = `https://www.britishcycling.org.uk/points?d=4&person_id=${person_id}&year=${year}`;
    log.info('puppeteer_goto_start', { request_type: 'road-track', url: regularUrl });
    const gotoStart = Date.now();

    try {
      await Promise.race([
        page.goto(regularUrl, { waitUntil: 'networkidle2', timeout: 120000 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Page goto timeout after 120s')), 120000)
        ),
      ]);
    } catch (err) {
      const gotoDuration = Date.now() - gotoStart;
      log.error('puppeteer_goto_failed', { duration_ms: gotoDuration, err });
      throw err;
    }

    const gotoDuration = Date.now() - gotoStart;
    log.info('puppeteer_goto_success', { duration_ms: gotoDuration, request_type: 'road-track' });

    log.debug('puppeteer_wait_start', { wait_ms: 5000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    log.debug('puppeteer_wait_done', { wait_ms: 5000 });

    let regularHtml = await page.content();
    log.info('html_received', { html_length: regularHtml.length, request_type: 'road-track' });

    if (process.env.NODE_ENV !== 'production') {
      saveDebugPageContent(log, regularUrl, regularHtml, person_id, discipline, 'road-track');
    }

    const titleMatch = regularHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1] : null;
    log.debug('page_title', { title: pageTitle });

    let cloudflareSeen = false;
    let cloudflareResolved = false;
    if (isCloudflareChallenge(regularHtml)) {
      cloudflareSeen = true;
      log.warn('cloudflare_detected', {
        title: pageTitle,
        html_length: regularHtml.length,
      });
      await new Promise(resolve => setTimeout(resolve, 20000));
      regularHtml = await page.content();
      log.info('cloudflare_recheck', { html_length: regularHtml.length });
      if (isCloudflareChallenge(regularHtml)) {
        log.error('cloudflare_persistent', { html_length: regularHtml.length });
        throw new Error('Cloudflare challenge not resolved');
      }
      cloudflareResolved = true;
      log.info('cloudflare_resolved');
    }

    // Extract name and club
    const nameMatch = regularHtml.match(/<h1 class="article__header__title-opener">Points: ([^<]+)<\/h1>/);
    const name = nameMatch?.[1]?.trim() || '';
    log.debug('name_extracted', { matched: !!nameMatch, name });

    let club = '';
    let clubId = '';
    const currentYear = new Date().getFullYear().toString();

    const clubRegex = year === currentYear
      ? /<dd>Current Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/
      : /<dd>Year End Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;

    const clubMatch = regularHtml.match(clubRegex);
    log.debug('club_extracted', {
      regex: year === currentYear ? 'current' : 'year_end',
      matched: !!clubMatch,
    });
    if (clubMatch?.[2]) {
      club = clubMatch[2].trim();
      clubId = clubMatch[1];
    }

    const categoryMatch = regularHtml.match(/<dd>Category:\s*([^<]+)<\/dd>/);
    const category = categoryMatch?.[1]?.trim() || '';
    log.debug('category_extracted', { matched: !!categoryMatch, category });

    log.info('extracted_data', { name, club, club_id: clubId, category });

    let cyclocrossData = { raceCount: 0, totalPoints: 0, regionalPoints: 0, nationalPoints: 0 };

    const regularData = processRegularPoints(regularHtml, log);

    // Update clubs cache
    if (club && clubId && clubsFile) {
      try {
        let clubs = {};
        if (fs.existsSync(clubsFile)) {
          clubs = JSON.parse(fs.readFileSync(clubsFile, 'utf8'));
        }
        if (!clubs[club]) {
          clubs[club] = { id: clubId, members: [] };
        } else if (!clubs[club].id) {
          clubs[club].id = clubId;
        }
        fs.writeFileSync(clubsFile, JSON.stringify(clubs, null, 2), 'utf8');
      } catch (err) {
        log.error('clubs_cache_update_failed', { err });
      }
    }

    const result = {
      raceCount: regularData.raceCount + cyclocrossData.raceCount,
      points: regularData.totalPoints + cyclocrossData.totalPoints,
      roadAndTrackPoints: regularData.totalPoints,
      cyclocrossPoints: 0,
      roadAndTrackRaceCount: regularData.raceCount,
      cyclocrossRaceCount: 0,
      category,
      name,
      club,
      clubId,
      regionalPoints: regularData.regionalPoints + cyclocrossData.regionalPoints,
      nationalPoints: regularData.nationalPoints + cyclocrossData.nationalPoints,
      roadRegionalPoints: regularData.regionalPoints,
      roadNationalPoints: regularData.nationalPoints,
      cxRegionalPoints: 0,
      cxNationalPoints: 0,
      // Non-persisted diagnostics: stripped before writing to disk by the
      // caller. Lets the cache_attempt_summary record what happened during
      // the fetch on a single line.
      _diagnostics: {
        html_length: regularHtml.length,
        page_title: pageTitle,
        cloudflare_seen: cloudflareSeen,
        cloudflare_resolved: cloudflareResolved,
        name_extracted: !!name,
        club_extracted: !!club,
        category_extracted: !!category,
        parse: regularData.parseDiagnostics || null,
      },
    };

    const duration = Date.now() - startTime;
    log.info('fetch_end', {
      success: true,
      duration_ms: duration,
      points: result.points,
      races: result.raceCount,
      cloudflare_seen: cloudflareSeen,
      parse_warnings: regularData.parseDiagnostics
        ? regularData.parseDiagnostics.warnings
        : [],
    });
    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    log.error('fetch_end', {
      success: false,
      duration_ms: duration,
      err,
    });
    throw err;
  } finally {
    if (browser) {
      const closeStart = Date.now();
      log.debug('puppeteer_close_start');
      await browser.close();
      const closeDuration = Date.now() - closeStart;
      log.debug('puppeteer_closed', { duration_ms: closeDuration });
    }
  }
}

module.exports = { fetchRacerData };
