const axios = require('axios');
const fs = require('fs');

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
  return processRegularPoints(html); // Same logic
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

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
      return response.data;
    } catch (err) {
      const duration = Date.now() - attemptStart;
      console.log(`AXIOS_RETRY: attempt=${i + 1}/${maxRetries}, duration=${duration}ms, error_code=${err.code}, error_msg="${err.message}", status=${err.response?.status}`);
      if (i === maxRetries - 1) throw err;
      // Don't add extra wait here since we already delay at start of next iteration
    }
  }
}

async function fetchRacerData(person_id, year, clubsFile) {
  const startTime = Date.now();
  console.log(`[${person_id}] AXIOS_START: timestamp=${new Date().toISOString()}, person_id=${person_id}, year=${year}`);
  
  try {
    
    const regularUrl = `https://www.britishcycling.org.uk/points?d=4&person_id=${person_id}&year=${year}`;
    const regularHtml = await fetchWithRetry(regularUrl);
    
    if (regularHtml.includes('Just a moment') || regularHtml.includes('cloudflare') || regularHtml.includes('403 Forbidden') || regularHtml.length < 1000) {
      console.log(`AXIOS_BLOCKED: detected blocking, html_length=${regularHtml.length}, contains_403=${regularHtml.includes('403')}, contains_cloudflare=${regularHtml.includes('cloudflare')}`);
      throw new Error('Request blocked - use Puppeteer fallback');
    }
    
    console.log(`AXIOS_HTML_OK: regular_page loaded, html_length=${regularHtml.length}`);

    // Extract data (same logic as Puppeteer version)
    const nameMatch = regularHtml.match(/<h1 class="article__header__title-opener">Points: ([^<]+)<\/h1>/);
    const name = nameMatch?.[1]?.trim() || '';

    let club = '';
    let clubId = '';
    const currentYear = new Date().getFullYear().toString();
    
    const clubRegex = year === currentYear 
      ? /<dd>Current Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/
      : /<dd>Year End Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
    
    const clubMatch = regularHtml.match(clubRegex);
    if (clubMatch?.[2]) {
      club = clubMatch[2].trim();
      clubId = clubMatch[1];
    }

    const categoryMatch = regularHtml.match(/<dd>Category:\s*([^<]+)<\/dd>/);
    const category = categoryMatch?.[1]?.trim() || '';

    // Fetch cyclocross data
    let cyclocrossData = { raceCount: 0, totalPoints: 0, regionalPoints: 0, nationalPoints: 0 };
    try {
      const cyclocrossUrl = `https://www.britishcycling.org.uk/points?d=6&person_id=${person_id}&year=${year}`;
      const cyclocrossHtml = await fetchWithRetry(cyclocrossUrl);
      
      if (!cyclocrossHtml.includes('Just a moment') && !cyclocrossHtml.includes('cloudflare')) {
        console.log(`AXIOS_HTML_OK: cyclocross_page loaded, html_length=${cyclocrossHtml.length}`);
        cyclocrossData = processCyclocrossPoints(cyclocrossHtml);
      } else {
        console.log(`AXIOS_CLOUDFLARE: cyclocross challenge detected, html_length=${cyclocrossHtml.length}`);
      }
    } catch (err) {
      console.log(`[${person_id}] Failed to fetch cyclocross data: ${err.message}`);
    }

    const regularData = processRegularPoints(regularHtml);

    const result = {
      raceCount: regularData.raceCount + cyclocrossData.raceCount,
      points: regularData.totalPoints + cyclocrossData.totalPoints,
      roadAndTrackPoints: regularData.totalPoints,
      cyclocrossPoints: cyclocrossData.totalPoints,
      roadAndTrackRaceCount: regularData.raceCount,
      cyclocrossRaceCount: cyclocrossData.raceCount,
      category,
      name,
      club,
      clubId
    };
    
    const duration = Date.now() - startTime;
    console.log(`[${person_id}] AXIOS_END: success=true, duration=${duration}ms, points=${result.points}, races=${result.raceCount}`);
    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    console.log(`[${person_id}] AXIOS_END: success=false, duration=${duration}ms, error="${err.message}"`);
    throw err;
  }
}

module.exports = { fetchRacerData };