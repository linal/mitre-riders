const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Helper functions (same as before)
function processRegularPoints(html) {
  let raceCount = 0;
  let totalPoints = 0;
  let regionalPoints = 0;
  let nationalPoints = 0;

  const tbodyStart = html.indexOf("<tbody>");
  const tbodyEnd = html.indexOf("</tbody>");

  if (tbodyStart !== -1 && tbodyEnd !== -1) {
    const tbody = html.slice(tbodyStart, tbodyEnd);
    const eventIdMatches = [...tbody.matchAll(/\/events\/details\/(\d+)\//g)];
    const uniqueEventIds = new Set(eventIdMatches.map(match => match[1]));
    raceCount = uniqueEventIds.size;

    const rows = tbody.split("<tr>");
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.split("<td>");

      if (cells.length >= 6) {
        const categoryCell = cells[2];
        const pointsCell = cells[5];
        const pointsEndIndex = pointsCell.indexOf("</td>");
        if (pointsEndIndex !== -1) {
          const pointsValue = pointsCell.substring(0, pointsEndIndex).trim();
          const points = isNaN(Number(pointsValue)) ? 0 : Number(pointsValue);

          if (categoryCell.includes("National")) {
            nationalPoints += points;
          } else {
            regionalPoints += points;
          }
        }
      }
    }
  }

  const tfootStart = html.indexOf("<tfoot>");
  if (tfootStart !== -1) {
    let pos = html.indexOf("<td>", tfootStart);
    for (let i = 0; i < 4 && pos !== -1; i++) {
      pos = html.indexOf("<td>", pos + 1);
    }
    if (pos !== -1) {
      const start = pos + 4;
      const end = html.indexOf("</td>", start);
      const value = html.slice(start, end).trim();
      totalPoints = isNaN(Number(value)) ? 0 : Number(value);
    }
  }

  return { raceCount, totalPoints, regionalPoints, nationalPoints };
}

function processCyclocrossPoints(html) {
  // Cyclocross disabled
  return { raceCount: 0, totalPoints: 0, regionalPoints: 0, nationalPoints: 0 };
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Debug function to save response data when running locally
function saveDebugResponse(url, response, person_id, discipline, requestType = 'unknown') {
  // Only save debug files when running locally
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
      full_data: response.data
    };

    // Save JSON debug file
    fs.writeFileSync(jsonFilepath, JSON.stringify(debugData, null, 2), 'utf8');
    console.log(`[${person_id}] DEBUG_SAVED: ${jsonFilepath}`);

    // Save HTML file separately
    if (response.data) {
      fs.writeFileSync(htmlFilepath, response.data, 'utf8');
      console.log(`[${person_id}] DEBUG_HTML_SAVED: ${htmlFilepath}`);
    }
  } catch (err) {
    console.error(`[${person_id}] DEBUG_SAVE_ERROR: ${err.message}`);
  }
}

// Wrapper for fetchWithRetry that includes context for debugging
async function fetchWithRetryWithContext(url, person_id, discipline, requestType, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const attemptStart = Date.now();
    try {
      // Add delay between requests to avoid rate limiting
      if (i > 0) {
        const delay = 2000 + (i * 3000); // 2s, 5s, 8s delays
        console.log(`AXIOS_DELAY: waiting ${delay}ms to avoid rate limiting`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      console.log(`AXIOS_REQUEST: attempt=${i + 1}/${maxRetries}, url=${url}, timeout=60000ms`);
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
          'Upgrade-Insecure-Requests': '1'
        }
      });
      const duration = Date.now() - attemptStart;
      console.log(`AXIOS_SUCCESS: attempt=${i + 1}, duration=${duration}ms, status=${response.status}, content_length=${response.data?.length}`);
      
      // Save debug response if running locally
      if (process.env.NODE_ENV !== 'production') {
        saveDebugResponse(url, response, person_id, discipline, requestType);
      }
      
      return response.data;
    } catch (err) {
      const duration = Date.now() - attemptStart;
      console.log(`AXIOS_RETRY: attempt=${i + 1}/${maxRetries}, duration=${duration}ms, error_code=${err.code}, error_msg="${err.message}", status=${err.response?.status}`);
      if (i === maxRetries - 1) throw err;
      // Don't add extra wait here since we already delay at start of next iteration
    }
  }
}

async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const attemptStart = Date.now();
    try {
      // Add delay between requests to avoid rate limiting
      if (i > 0) {
        const delay = 2000 + (i * 3000); // 2s, 5s, 8s delays
        console.log(`AXIOS_DELAY: waiting ${delay}ms to avoid rate limiting`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      console.log(`AXIOS_REQUEST: attempt=${i + 1}/${maxRetries}, url=${url}, timeout=60000ms`);
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
          'Upgrade-Insecure-Requests': '1'
        }
      });
      const duration = Date.now() - attemptStart;
      console.log(`AXIOS_SUCCESS: attempt=${i + 1}, duration=${duration}ms, status=${response.status}, content_length=${response.data?.length}`);
      
      // Note: Debug saving is handled in fetchWithRetryWithContext, not here
      
      return response.data;
    } catch (err) {
      const duration = Date.now() - attemptStart;
      console.log(`AXIOS_RETRY: attempt=${i + 1}/${maxRetries}, duration=${duration}ms, error_code=${err.code}, error_msg="${err.message}", status=${err.response?.status}`);
      if (i === maxRetries - 1) throw err;
      // Don't add extra wait here since we already delay at start of next iteration
    }
  }
}

async function fetchRacerData(person_id, year, clubsFile, discipline = 'both') {
  const startTime = Date.now();
  console.log(`[${person_id}] AXIOS_START: timestamp=${new Date().toISOString()}, person_id=${person_id}, year=${year}, discipline=${discipline}`);
  
  try {
    let name = '';
    let club = '';
    let clubId = '';
    let category = '';
    const currentYear = new Date().getFullYear().toString();
    
    let regularData = { raceCount: 0, totalPoints: 0, regionalPoints: 0, nationalPoints: 0 };
    let cyclocrossData = { raceCount: 0, totalPoints: 0, regionalPoints: 0, nationalPoints: 0 };

    // Fetch road and track data if requested
    if (discipline === 'road-track' || discipline === 'both') {
      const regularUrl = `https://www.britishcycling.org.uk/points?d=4&person_id=${person_id}&year=${year}`;
      const regularHtml = await fetchWithRetryWithContext(regularUrl, person_id, discipline, 'road-track');
      
      if (regularHtml.includes('Just a moment') || regularHtml.includes('cloudflare') || regularHtml.includes('403 Forbidden') || regularHtml.length < 1000) {
        console.log(`AXIOS_BLOCKED: detected blocking, html_length=${regularHtml.length}, contains_403=${regularHtml.includes('403')}, contains_cloudflare=${regularHtml.includes('cloudflare')}`);
        throw new Error('Request blocked - use Puppeteer fallback');
      }
      
      console.log(`AXIOS_HTML_OK: regular_page loaded, html_length=${regularHtml.length}`);

      // Extract data from road/track page
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

    // Cyclocross fetching disabled

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
      discipline: 'road-track'
    };
    
    const duration = Date.now() - startTime;
    console.log(`[${person_id}] AXIOS_END: success=true, duration=${duration}ms, points=${result.points}, races=${result.raceCount}, discipline=${discipline}`);
    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    console.log(`[${person_id}] AXIOS_END: success=false, duration=${duration}ms, error="${err.message}", discipline=${discipline}`);
    throw err;
  }
}

module.exports = { fetchRacerData };