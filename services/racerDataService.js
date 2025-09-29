const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Debug function to save page content when running locally
function saveDebugPageContent(url, html, person_id, discipline, requestType = 'unknown') {
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

    // Save JSON debug file
    fs.writeFileSync(jsonFilepath, JSON.stringify(debugData, null, 2), 'utf8');
    console.log(`[${person_id}] DEBUG_PAGE_SAVED: ${jsonFilepath}`);

    // Save HTML file separately
    if (html) {
      fs.writeFileSync(htmlFilepath, html, 'utf8');
      console.log(`[${person_id}] DEBUG_HTML_SAVED: ${htmlFilepath}`);
    }
  } catch (err) {
    console.error(`[${person_id}] DEBUG_PAGE_SAVE_ERROR: ${err.message}`);
  }
}

// Helper function to process regular points from HTML
function processRegularPoints(html) {
  console.log('PROCESS_REGULAR: Starting HTML processing');
  let raceCount = 0;
  let totalPoints = 0;
  let regionalPoints = 0;
  let nationalPoints = 0;

  const tbodyStart = html.indexOf("<tbody>");
  const tbodyEnd = html.indexOf("</tbody>");
  console.log(`PROCESS_REGULAR: tbody found=${tbodyStart !== -1 && tbodyEnd !== -1}, start=${tbodyStart}, end=${tbodyEnd}`);

  if (tbodyStart !== -1 && tbodyEnd !== -1) {
    const tbody = html.slice(tbodyStart, tbodyEnd);
    const eventIdMatches = [...tbody.matchAll(/\/events\/details\/(\d+)\//g)];
    const uniqueEventIds = new Set(eventIdMatches.map(match => match[1]));
    raceCount = uniqueEventIds.size;
    console.log(`PROCESS_REGULAR: Found ${eventIdMatches.length} event matches, ${raceCount} unique races`);

    const rows = tbody.split("<tr>");
    console.log(`PROCESS_REGULAR: Processing ${rows.length - 1} table rows`);
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
  console.log(`PROCESS_REGULAR: tfoot found=${tfootStart !== -1}`);
  if (tfootStart !== -1) {
    const tfootSection = html.slice(tfootStart, tfootStart + 500);
    console.log(`PROCESS_REGULAR: tfoot preview=${tfootSection.replace(/\n/g, ' ').replace(/\s+/g, ' ')}`);
    let pos = html.indexOf("<td>", tfootStart);
    for (let i = 0; i < 4 && pos !== -1; i++) {
      pos = html.indexOf("<td>", pos + 1);
    }
    if (pos !== -1) {
      const start = pos + 4;
      const end = html.indexOf("</td>", start);
      const value = html.slice(start, end).trim();
      totalPoints = isNaN(Number(value)) ? 0 : Number(value);
      console.log(`PROCESS_REGULAR: Total points extracted='${value}', parsed=${totalPoints}`);
    }
  }

  console.log(`PROCESS_REGULAR: Final results - races=${raceCount}, total=${totalPoints}, regional=${regionalPoints}, national=${nationalPoints}`);
  return { raceCount, totalPoints, regionalPoints, nationalPoints };
}

// Helper function to process cyclocross points from HTML
function processCyclocrossPoints(html) {
  console.log('PROCESS_CX: Starting cyclocross HTML processing');
  let raceCount = 0;
  let totalPoints = 0;
  let regionalPoints = 0;
  let nationalPoints = 0;

  const tbodyStart = html.indexOf("<tbody>");
  const tbodyEnd = html.indexOf("</tbody>");
  console.log(`PROCESS_CX: tbody found=${tbodyStart !== -1 && tbodyEnd !== -1}, start=${tbodyStart}, end=${tbodyEnd}`);

  if (tbodyStart !== -1 && tbodyEnd !== -1) {
    const tbody = html.slice(tbodyStart, tbodyEnd);
    const eventIdMatches = [...tbody.matchAll(/\/events\/details\/(\d+)\//g)];
    const uniqueEventIds = new Set(eventIdMatches.map(match => match[1]));
    raceCount = uniqueEventIds.size;
    console.log(`PROCESS_CX: Found ${eventIdMatches.length} event matches, ${raceCount} unique races`);

    const rows = tbody.split("<tr>");
    console.log(`PROCESS_CX: Processing ${rows.length - 1} table rows`);
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
  console.log(`PROCESS_CX: tfoot found=${tfootStart !== -1}`);
  if (tfootStart !== -1) {
    const tfootSection = html.slice(tfootStart, tfootStart + 500);
    console.log(`PROCESS_CX: tfoot preview=${tfootSection.replace(/\n/g, ' ').replace(/\s+/g, ' ')}`);
    let pos = html.indexOf("<td>", tfootStart);
    for (let i = 0; i < 4 && pos !== -1; i++) {
      pos = html.indexOf("<td>", pos + 1);
    }
    if (pos !== -1) {
      const start = pos + 4;
      const end = html.indexOf("</td>", start);
      const value = html.slice(start, end).trim();
      totalPoints = isNaN(Number(value)) ? 0 : Number(value);
      console.log(`PROCESS_CX: Total points extracted='${value}', parsed=${totalPoints}`);
    }
  }

  console.log(`PROCESS_CX: Final results - races=${raceCount}, total=${totalPoints}, regional=${regionalPoints}, national=${nationalPoints}`);
  return { raceCount, totalPoints, regionalPoints, nationalPoints };
}

// Main service function to fetch and process racer data
async function fetchRacerData(person_id, year, clubsFile, discipline = 'both') {
  const startTime = Date.now();
  console.log(`[${person_id}] PUPPETEER_START: timestamp=${new Date().toISOString()}, person_id=${person_id}, year=${year}, discipline=${discipline}`);
  
  const launchStart = Date.now();
  console.log(`[${person_id}] PUPPETEER_LAUNCH: starting browser, timeout=300000ms, protocol_timeout=300000ms`);
  
  let browser;
  let foundChrome = null;
  
  try {
    console.log(`[${person_id}] PUPPETEER_ENV: NODE_ENV=${process.env.NODE_ENV}, Platform=${process.platform}`);

    // Resolve Chrome/Edge executable cross-platform. If not found, fall back to Puppeteer's bundled Chromium.
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
          '/usr/bin/chromium-browser'
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
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        ];
        for (const p of macPaths) {
          if (fs.existsSync(p)) return p;
        }
        return null;
      }

      return null;
    }

    foundChrome = resolveChromeExecutable();
    if (foundChrome) {
      console.log(`[${person_id}] CHROME_EXECUTABLE_FOUND: ${foundChrome}`);
    } else {
      console.log(`[${person_id}] CHROME_NOT_FOUND: Falling back to Puppeteer's bundled Chromium`);
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
        '--window-size=1280,720'
      ]
    };
    if (foundChrome) {
      launchOptions.executablePath = foundChrome;
    }

    browser = await Promise.race([
      puppeteer.launch(launchOptions),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Browser launch timeout after 30s')), 30000))
    ]);
  } catch (err) {
    const launchDuration = Date.now() - launchStart;
    const memInfo = process.memoryUsage();
    console.log(`[${person_id}] PUPPETEER_LAUNCH_FAILED: duration=${launchDuration}ms, error="${err.message}"`);
    console.log(`[${person_id}] MEMORY_DETAILED: heap=${(memInfo.heapUsed/1024/1024).toFixed(1)}MB, rss=${(memInfo.rss/1024/1024).toFixed(1)}MB, external=${(memInfo.external/1024/1024).toFixed(1)}MB`);
    console.log(`[${person_id}] SYSTEM_DETAILED: uptime=${process.uptime()}s, platform=${process.platform}, arch=${process.arch}`);
    
    // Check if Chrome processes are running (best-effort, platform-specific)
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        const processes = execSync('tasklist | findstr /I "chrome msedge chromium"', { encoding: 'utf8' });
        console.log(`[${person_id}] CHROME_PROCESSES_WIN: ${processes.split('\n').filter(Boolean).length} lines`);
      } else {
        const processes = execSync('ps aux | grep -E "(chrome|chromium|msedge)" || true', { encoding: 'utf8' });
        console.log(`[${person_id}] CHROME_PROCESSES_UNIX: ${processes.split('\n').length - 1} processes found`);
      }
    } catch (psErr) {
      console.log(`[${person_id}] PROCESS_CHECK_FAILED: ${psErr.message}`);
    }

    // Surface the original launch error
    throw new Error(`Browser launch failed: ${err.message}`);
  }
  
  const launchDuration = Date.now() - launchStart;
  console.log(`[${person_id}] PUPPETEER_LAUNCHED: browser ready in ${launchDuration}ms`);
  
  const pageStart = Date.now();
  const page = await browser.newPage();
  const pageDuration = Date.now() - pageStart;
  console.log(`[${person_id}] PUPPETEER_PAGE: new page created in ${pageDuration}ms`);

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
    console.log(`[${person_id}] PUPPETEER_GOTO_START: Fetching regular points: ${regularUrl}`);
    const gotoStart = Date.now();
    
    try {
      await Promise.race([
        page.goto(regularUrl, { waitUntil: 'networkidle2', timeout: 120000 }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Page goto timeout after 120s')), 120000)
        )
      ]);
    } catch (err) {
      const gotoDuration = Date.now() - gotoStart;
      console.log(`[${person_id}] PUPPETEER_GOTO_FAILED: duration=${gotoDuration}ms, error="${err.message}"`);
      throw err;
    }
    
    const gotoDuration = Date.now() - gotoStart;
    console.log(`[${person_id}] PUPPETEER_GOTO_SUCCESS: regular page loaded in ${gotoDuration}ms`);
    
    console.log(`[${person_id}] PUPPETEER_WAIT: Starting 5s wait`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log(`[${person_id}] PUPPETEER_WAIT: 5s wait completed`);

      let regularHtml = await page.content();
      console.log(`[${person_id}] Regular HTML length: ${regularHtml.length}`);
      
      // Save debug page content if running locally
      if (process.env.NODE_ENV !== 'production') {
        saveDebugPageContent(regularUrl, regularHtml, person_id, discipline, 'road-track');
      }
      
      // Log key HTML sections for LLM analysis
      const titleMatch = regularHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
      console.log(`[${person_id}] PAGE_TITLE: ${titleMatch ? titleMatch[1] : 'Not found'}`);
      
      const bodyStart = regularHtml.indexOf('<body');
      const bodyContent = bodyStart !== -1 ? regularHtml.substring(bodyStart, bodyStart + 1000) : 'Body not found';
      console.log(`[${person_id}] BODY_START: ${bodyContent.replace(/\n/g, ' ').replace(/\s+/g, ' ')}`);
      
      if (regularHtml.includes('Just a moment') || regularHtml.includes('cloudflare')) {
      console.log(`[${person_id}] CLOUDFLARE_DETECTED: Challenge page detected`);
      const cfContent = regularHtml.substring(0, 2000).replace(/\n/g, ' ').replace(/\s+/g, ' ');
      console.log(`[${person_id}] CLOUDFLARE_HTML: ${cfContent}`);
      await new Promise(resolve => setTimeout(resolve, 20000));
      regularHtml = await page.content();
      console.log(`[${person_id}] After wait, regular HTML length: ${regularHtml.length}`);
      if (regularHtml.includes('Just a moment') || regularHtml.includes('cloudflare')) {
        console.log(`[${person_id}] CLOUDFLARE_PERSISTENT: Challenge not resolved`);
        throw new Error('Cloudflare challenge not resolved');
      }
      console.log(`[${person_id}] CLOUDFLARE_RESOLVED: Challenge passed`);
    }

    // Log HTML structure for data extraction analysis
    const headerSection = regularHtml.match(/<h1[^>]*class="article__header__title-opener"[^>]*>.*?<\/h1>/s);
    console.log(`[${person_id}] HEADER_SECTION: ${headerSection ? headerSection[0] : 'Not found'}`);
    
    const ddSections = [...regularHtml.matchAll(/<dd>[^<]*(?:<a[^>]*>[^<]*<\/a>)?[^<]*<\/dd>/g)];
    console.log(`[${person_id}] DD_SECTIONS: Found ${ddSections.length} sections`);
    ddSections.forEach((match, i) => {
      console.log(`[${person_id}] DD_${i}: ${match[0]}`);
    });
    
    // Extract name and club
    const nameMatch = regularHtml.match(/<h1 class="article__header__title-opener">Points: ([^<]+)<\/h1>/);
    const name = nameMatch?.[1]?.trim() || '';
    console.log(`[${person_id}] NAME_EXTRACTION: Match=${!!nameMatch}, Value='${name}'`);

    let club = '';
    let clubId = '';
    const currentYear = new Date().getFullYear().toString();
    
    const clubRegex = year === currentYear 
      ? /<dd>Current Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/
      : /<dd>Year End Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
    
    const clubMatch = regularHtml.match(clubRegex);
    console.log(`[${person_id}] CLUB_EXTRACTION: Regex=${year === currentYear ? 'Current' : 'YearEnd'}, Match=${!!clubMatch}`);
    if (clubMatch?.[2]) {
      club = clubMatch[2].trim();
      clubId = clubMatch[1];
    }

    const categoryMatch = regularHtml.match(/<dd>Category:\s*([^<]+)<\/dd>/);
    const category = categoryMatch?.[1]?.trim() || '';
    console.log(`[${person_id}] CATEGORY_EXTRACTION: Match=${!!categoryMatch}, Value='${category}'`);

    console.log(`[${person_id}] EXTRACTED_DATA: Name='${name}', Club='${club}', Category='${category}'`);
    
    // Fetch cyclocross points
    let cyclocrossData = { raceCount: 0, totalPoints: 0, regionalPoints: 0, nationalPoints: 0 };
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const cyclocrossUrl = `https://www.britishcycling.org.uk/points?d=6&person_id=${person_id}&year=${year}`;
      console.log(`[${person_id}] PUPPETEER_CX_GOTO_START: Fetching cyclocross points: ${cyclocrossUrl}`);
      const cxGotoStart = Date.now();
      
      try {
        await Promise.race([
          page.goto(cyclocrossUrl, { waitUntil: 'networkidle2', timeout: 120000 }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('CX page goto timeout after 120s')), 120000)
          )
        ]);
      } catch (err) {
        const cxGotoDuration = Date.now() - cxGotoStart;
        console.log(`[${person_id}] PUPPETEER_CX_GOTO_FAILED: duration=${cxGotoDuration}ms, error="${err.message}"`);
        throw err;
      }
      
      const cxGotoDuration = Date.now() - cxGotoStart;
      console.log(`[${person_id}] PUPPETEER_CX_GOTO_SUCCESS: cyclocross page loaded in ${cxGotoDuration}ms`);
      
      console.log(`[${person_id}] PUPPETEER_CX_WAIT: Starting 5s wait`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log(`[${person_id}] PUPPETEER_CX_WAIT: 5s wait completed`);

        let cyclocrossHtml = await page.content();
        console.log(`[${person_id}] Cyclocross HTML length: ${cyclocrossHtml.length}`);
        
        // Save debug page content if running locally
        if (process.env.NODE_ENV !== 'production') {
          saveDebugPageContent(cyclocrossUrl, cyclocrossHtml, person_id, discipline, 'cyclocross');
        }
        
        // Log cyclocross page structure
        const cxTitleMatch = cyclocrossHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
        console.log(`[${person_id}] CX_PAGE_TITLE: ${cxTitleMatch ? cxTitleMatch[1] : 'Not found'}`);
        
        const cxTableMatch = cyclocrossHtml.match(/<table[^>]*>.*?<\/table>/s);
        console.log(`[${person_id}] CX_TABLE_FOUND: ${!!cxTableMatch}`);
        if (cxTableMatch) {
          const tablePreview = cxTableMatch[0].substring(0, 500).replace(/\n/g, ' ').replace(/\s+/g, ' ');
          console.log(`[${person_id}] CX_TABLE_PREVIEW: ${tablePreview}`);
        }
        
        if (cyclocrossHtml.includes('Just a moment') || cyclocrossHtml.includes('cloudflare')) {
        console.log(`[${person_id}] CX_CLOUDFLARE_DETECTED: Challenge page detected`);
        await new Promise(resolve => setTimeout(resolve, 20000));
        cyclocrossHtml = await page.content();
        console.log(`[${person_id}] After wait, cyclocross HTML length: ${cyclocrossHtml.length}`);
        if (cyclocrossHtml.includes('Just a moment') || cyclocrossHtml.includes('cloudflare')) {
          console.log(`[${person_id}] CX_CLOUDFLARE_PERSISTENT: Skipping cyclocross data`);
        } else {
          console.log(`[${person_id}] CX_CLOUDFLARE_RESOLVED: Processing cyclocross data`);
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
        console.log(`[${person_id}] CX_NO_CLOUDFLARE: Processing cyclocross data`);
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
      clubId,
      regionalPoints: regularData.regionalPoints + cyclocrossData.regionalPoints,
      nationalPoints: regularData.nationalPoints + cyclocrossData.nationalPoints,
      roadRegionalPoints: regularData.regionalPoints,
      roadNationalPoints: regularData.nationalPoints,
      cxRegionalPoints: cyclocrossData.regionalPoints,
      cxNationalPoints: cyclocrossData.nationalPoints
    };
    
    const duration = Date.now() - startTime;
    console.log(`[${person_id}] PUPPETEER_END: success=true, duration=${duration}ms, points=${result.points}, races=${result.raceCount}`);
    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    console.log(`[${person_id}] PUPPETEER_END: success=false, duration=${duration}ms, error="${err.message}"`);
    throw err;
  } finally {
    if (browser) {
      const closeStart = Date.now();
      console.log(`[${person_id}] PUPPETEER_CLOSE: Starting browser close`);
      await browser.close();
      const closeDuration = Date.now() - closeStart;
      console.log(`[${person_id}] PUPPETEER_CLOSED: Browser closed in ${closeDuration}ms`);
    }
  }
}

module.exports = { fetchRacerData };