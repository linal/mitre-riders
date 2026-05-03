const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

function processRegularPoints(html) {
  let raceCount = 0;
  let totalPoints = 0;
  let regionalPoints = 0;
  let nationalPoints = 0;

  const tbodyStart = html.indexOf('<tbody>');
  const tbodyEnd = html.indexOf('</tbody>');

  if (tbodyStart !== -1 && tbodyEnd !== -1) {
    const tbody = html.slice(tbodyStart, tbodyEnd);
    const eventIdMatches = [...tbody.matchAll(/\/events\/details\/(\d+)\//g)];
    const uniqueEventIds = new Set(eventIdMatches.map(match => match[1]));
    raceCount = uniqueEventIds.size;

    const rows = tbody.split('<tr>');
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.split('<td>');

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
        }
      }
    }
  }

  const tfootStart = html.indexOf('<tfoot>');
  if (tfootStart !== -1) {
    let pos = html.indexOf('<td>', tfootStart);
    for (let i = 0; i < 4 && pos !== -1; i++) {
      pos = html.indexOf('<td>', pos + 1);
    }
    if (pos !== -1) {
      const start = pos + 4;
      const end = html.indexOf('</td>', start);
      const value = html.slice(start, end).trim();
      totalPoints = isNaN(Number(value)) ? 0 : Number(value);
    }
  }

  return { raceCount, totalPoints, regionalPoints, nationalPoints };
}

function processCyclocrossPoints(_html) {
  // Cyclocross disabled
  return { raceCount: 0, totalPoints: 0, regionalPoints: 0, nationalPoints: 0 };
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// Debug function to save response data when running locally
function saveDebugResponse(log, url, response, person_id, discipline, requestType = 'unknown') {
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
    const baseFilename = `bc_response_${disciplinePrefix}_${requestType}_${person_id}_${timestamp}`;
    const jsonFilepath = path.join(debugDir, `${baseFilename}.json`);
    const htmlFilepath = path.join(debugDir, `${baseFilename}.html`);

    const debugData = {
      timestamp: new Date().toISOString(),
      person_id: person_id,
      discipline: discipline,
      request_type: requestType,
      url: url,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data_length: response.data ? response.data.length : 0,
      data_preview: response.data ? response.data.substring(0, 1000) : null,
      full_data: response.data,
    };

    fs.writeFileSync(jsonFilepath, JSON.stringify(debugData, null, 2), 'utf8');
    log.debug('debug_response_saved', { path: jsonFilepath, request_type: requestType });

    if (response.data) {
      fs.writeFileSync(htmlFilepath, response.data, 'utf8');
      log.debug('debug_html_saved', { path: htmlFilepath, request_type: requestType });
    }
  } catch (err) {
    log.error('debug_response_save_error', { err });
  }
}

// Wrapper for fetchWithRetry that includes context for debugging
async function fetchWithRetryWithContext(log, url, person_id, discipline, requestType, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const attemptStart = Date.now();
    try {
      if (i > 0) {
        const delay = 2000 + (i * 3000);
        log.info('axios_delay', { wait_ms: delay, reason: 'rate_limit_backoff' });
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      log.info('axios_request', {
        attempt: i + 1,
        max_retries: maxRetries,
        url,
        timeout_ms: 60000,
      });
      const response = await axios.get(url, {
        timeout: 60000,
        headers: {
          'User-Agent': userAgents[i % userAgents.length],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1',
        },
      });
      const duration = Date.now() - attemptStart;
      log.info('axios_success', {
        attempt: i + 1,
        duration_ms: duration,
        status: response.status,
        content_length: response.data?.length,
      });

      if (process.env.NODE_ENV !== 'production') {
        saveDebugResponse(log, url, response, person_id, discipline, requestType);
      }

      return response.data;
    } catch (err) {
      const duration = Date.now() - attemptStart;
      log.warn('axios_retry', {
        attempt: i + 1,
        max_retries: maxRetries,
        duration_ms: duration,
        error_code: err.code,
        error_message: err.message,
        status: err.response?.status,
      });
      if (i === maxRetries - 1) throw err;
    }
  }
}

// Detect a real Cloudflare interstitial / blocked response.
function isBlockedResponse(html) {
  if (!html || typeof html !== 'string') return true;
  if (html.length < 1000) return true;
  if (html.includes('403 Forbidden')) return true;
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

async function fetchRacerData(person_id, year, _clubsFile, discipline = 'both') {
  const startTime = Date.now();
  const log = logger.child({
    component: 'axios',
    person_id,
    year,
    discipline,
  });

  log.info('fetch_start', { timestamp: new Date().toISOString() });

  try {
    let name = '';
    let club = '';
    let clubId = '';
    let category = '';
    const currentYear = new Date().getFullYear().toString();

    let regularData = { raceCount: 0, totalPoints: 0, regionalPoints: 0, nationalPoints: 0 };
    let cyclocrossData = { raceCount: 0, totalPoints: 0, regionalPoints: 0, nationalPoints: 0 };

    if (discipline === 'road-track' || discipline === 'both') {
      const regularUrl = `https://www.britishcycling.org.uk/points?d=4&person_id=${person_id}&year=${year}`;
      const regularHtml = await fetchWithRetryWithContext(log, regularUrl, person_id, discipline, 'road-track');

      if (isBlockedResponse(regularHtml)) {
        log.warn('axios_blocked', {
          html_length: regularHtml ? regularHtml.length : 0,
          contains_403: !!(regularHtml && regularHtml.includes('403')),
        });
        throw new Error('Request blocked - use Puppeteer fallback');
      }

      log.info('axios_html_ok', {
        html_length: regularHtml.length,
        request_type: 'road-track',
      });

      const nameMatch = regularHtml.match(/<h1 class="article__header__title-opener">Points: ([^<]+)<\/h1>/);
      name = nameMatch?.[1]?.trim() || '';

      const clubRegex = year === currentYear
        ? /<dd>Current Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/
        : /<dd>Year End Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;

      const clubMatch = regularHtml.match(clubRegex);
      if (clubMatch?.[2]) {
        club = clubMatch[2].trim();
        clubId = clubMatch[1];
      }

      const categoryMatch = regularHtml.match(/<dd>Category:\s*([^<]+)<\/dd>/);
      category = categoryMatch?.[1]?.trim() || '';

      regularData = processRegularPoints(regularHtml);
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
      discipline: 'road-track',
    };

    const duration = Date.now() - startTime;
    log.info('fetch_end', {
      success: true,
      duration_ms: duration,
      points: result.points,
      races: result.raceCount,
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
  }
}

module.exports = { fetchRacerData };
