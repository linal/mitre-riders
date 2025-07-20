const puppeteer = require('puppeteer');
const fs = require('fs');

// Helper function to process regular points from HTML
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

// Helper function to process cyclocross points from HTML
function processCyclocrossPoints(html) {
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

// Main service function to fetch and process racer data
async function fetchRacerData(person_id, year, clubsFile) {
  const launchStart = Date.now();
  console.log(`PUPPETEER_LAUNCH: starting browser, timeout=300000ms, protocol_timeout=300000ms`);
  const browser = await puppeteer.launch({
    headless: true,
    timeout: 300000,
    protocolTimeout: 300000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  const launchDuration = Date.now() - launchStart;
  console.log(`PUPPETEER_LAUNCHED: browser ready in ${launchDuration}ms`);
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  });

  try {
    console.log(`[${person_id}] PUPPETEER: Starting fetch for year ${year}`);
    
    // Fetch regular points
    const regularUrl = `https://www.britishcycling.org.uk/points?d=4&person_id=${person_id}&year=${year}`;
    console.log(`[${person_id}] PUPPETEER: Fetching regular points: ${regularUrl}`);
    const gotoStart = Date.now();
    await page.goto(regularUrl, { waitUntil: 'networkidle2', timeout: 300000 });
    const gotoDuration = Date.now() - gotoStart;
    console.log(`PUPPETEER_GOTO: regular page loaded in ${gotoDuration}ms`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    let regularHtml = await page.content();
    console.log(`[${person_id}] Regular HTML length: ${regularHtml.length}`);
    
    if (regularHtml.includes('Just a moment') || regularHtml.includes('cloudflare')) {
      console.log(`[${person_id}] Cloudflare challenge detected on regular page, waiting 20s...`);
      await new Promise(resolve => setTimeout(resolve, 20000));
      regularHtml = await page.content();
      console.log(`[${person_id}] After wait, regular HTML length: ${regularHtml.length}`);
      if (regularHtml.includes('Just a moment') || regularHtml.includes('cloudflare')) {
        console.log(`[${person_id}] Cloudflare challenge still present on regular page`);
        throw new Error('Cloudflare challenge not resolved');
      }
      console.log(`[${person_id}] Cloudflare challenge resolved on regular page`);
    }

    // Extract name and club
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

    console.log(`[${person_id}] Extracted - Name: ${name}, Club: ${club}, Category: ${category}`);
    
    // Fetch cyclocross points
    let cyclocrossData = { raceCount: 0, totalPoints: 0, regionalPoints: 0, nationalPoints: 0 };
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const cyclocrossUrl = `https://www.britishcycling.org.uk/points?d=6&person_id=${person_id}&year=${year}`;
      console.log(`[${person_id}] PUPPETEER: Fetching cyclocross points: ${cyclocrossUrl}`);
      const cxGotoStart = Date.now();
      await page.goto(cyclocrossUrl, { waitUntil: 'networkidle2', timeout: 300000 });
      const cxGotoDuration = Date.now() - cxGotoStart;
      console.log(`PUPPETEER_GOTO: cyclocross page loaded in ${cxGotoDuration}ms`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      let cyclocrossHtml = await page.content();
      console.log(`[${person_id}] Cyclocross HTML length: ${cyclocrossHtml.length}`);
      
      if (cyclocrossHtml.includes('Just a moment') || cyclocrossHtml.includes('cloudflare')) {
        console.log(`[${person_id}] Cloudflare challenge detected on cyclocross page, waiting 20s...`);
        await new Promise(resolve => setTimeout(resolve, 20000));
        cyclocrossHtml = await page.content();
        console.log(`[${person_id}] After wait, cyclocross HTML length: ${cyclocrossHtml.length}`);
        if (cyclocrossHtml.includes('Just a moment') || cyclocrossHtml.includes('cloudflare')) {
          console.log(`[${person_id}] Skipping cyclocross data due to persistent Cloudflare challenge`);
        } else {
          console.log(`[${person_id}] Cloudflare challenge resolved on cyclocross page`);
          cyclocrossData = processCyclocrossPoints(cyclocrossHtml);
          
          // Try to get club from cyclocross if not found
          if (!club) {
            const cxClubRegex = year === currentYear 
              ? /<dd>Current Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/
              : /<dd>Year End Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
            
            const cxClubMatch = cyclocrossHtml.match(cxClubRegex);
            if (cxClubMatch?.[2]) {
              club = cxClubMatch[2].trim();
              clubId = cxClubMatch[1];
            }
          }
        }
      } else {
        console.log(`[${person_id}] No Cloudflare challenge on cyclocross page`);
        cyclocrossData = processCyclocrossPoints(cyclocrossHtml);
        
        // Try to get club from cyclocross if not found
        if (!club) {
          const cxClubRegex = year === currentYear 
            ? /<dd>Current Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/
            : /<dd>Year End Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
          
          const cxClubMatch = cyclocrossHtml.match(cxClubRegex);
          if (cxClubMatch?.[2]) {
            club = cxClubMatch[2].trim();
            clubId = cxClubMatch[1];
          }
        }
      }
    } catch (err) {
      console.log(`[${person_id}] Failed to fetch cyclocross data: ${err.message}`);
    }

    // Process points data
    const regularData = processRegularPoints(regularHtml);
    console.log(`[${person_id}] Regular data: ${JSON.stringify(regularData)}`);
    console.log(`[${person_id}] Cyclocross data: ${JSON.stringify(cyclocrossData)}`);

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
        console.error(`Error updating clubs cache: ${err.message}`);
      }
    }

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
      clubId,
      regionalPoints: regularData.regionalPoints + cyclocrossData.regionalPoints,
      nationalPoints: regularData.nationalPoints + cyclocrossData.nationalPoints,
      roadRegionalPoints: regularData.regionalPoints,
      roadNationalPoints: regularData.nationalPoints,
      cxRegionalPoints: cyclocrossData.regionalPoints,
      cxNationalPoints: cyclocrossData.nationalPoints
    };
  } finally {
    await browser.close();
  }
}

module.exports = { fetchRacerData };