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

async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(url, {
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });
      return response.data;
    } catch (err) {
      console.log(`Attempt ${i + 1} failed: ${err.message}`);
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 5000 * (i + 1)));
    }
  }
}

async function fetchRacerData(person_id, year, clubsFile) {
  try {
    console.log(`[${person_id}] Starting axios fetch for year ${year}`);
    
    const regularUrl = `https://www.britishcycling.org.uk/points?d=4&person_id=${person_id}&year=${year}`;
    const regularHtml = await fetchWithRetry(regularUrl);
    
    if (regularHtml.includes('Just a moment') || regularHtml.includes('cloudflare')) {
      throw new Error('Cloudflare challenge detected - use Puppeteer fallback');
    }

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
        cyclocrossData = processCyclocrossPoints(cyclocrossHtml);
      }
    } catch (err) {
      console.log(`[${person_id}] Failed to fetch cyclocross data: ${err.message}`);
    }

    const regularData = processRegularPoints(regularHtml);

    return {
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
  } catch (err) {
    console.log(`[${person_id}] Axios method failed, falling back to Puppeteer`);
    throw err;
  }
}

module.exports = { fetchRacerData };