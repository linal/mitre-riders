const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend from /client
app.use(cors());
app.use(express.static(path.join(__dirname, 'client')));

// Simple in-memory cache
const cache = {};
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

app.get('/api/race-data', async (req, res) => {
  const { person_id, year } = req.query;
  if (!person_id || !year) {
    return res.status(400).send("Missing parameters");
  }

  const cacheKey = `${person_id}_${year}`;
  const now = Date.now();

  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL_MS) {
    return res.json(cache[cacheKey].data);
  }

  try {
    const url = `https://www.britishcycling.org.uk/points?d=4&person_id=${person_id}&year=${year}`;
    const response = await fetch(url);
    const html = await response.text();

    // Deduplicate races based on event ID in URL
    const tbodyStart = html.indexOf("<tbody>");
    const tbodyEnd = html.indexOf("</tbody>");
    let raceCount = 0;

    if (tbodyStart !== -1 && tbodyEnd !== -1) {
      const tbody = html.slice(tbodyStart, tbodyEnd);
      const eventIdMatches = [...tbody.matchAll(/\/events\/details\/(\d+)\//g)];
      const uniqueEventIds = new Set(eventIdMatches.map(match => match[1]));
      raceCount = uniqueEventIds.size;
    }

    // Extract total points from <tfoot>
    let points = 0;
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
        points = isNaN(Number(value)) ? 0 : Number(value);
      }
    }

    const result = { raceCount, points };
    cache[cacheKey] = { data: result, timestamp: now };
    res.json(result);
  } catch (err) {
    console.error("Error fetching or parsing race data:", err.message);
    res.status(500).send("Failed to fetch race data");
  }
});

// Serve React app for all unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});
