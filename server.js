const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

app.use(cors());

app.get('/api/race-data', async (req, res) => {
  const { person_id, year } = req.query;
  if (!person_id || !year) {
    return res.status(400).send("Missing parameters");
  }

  try {
    const url = `https://www.britishcycling.org.uk/points?person_id=${person_id}&year=${year}`;
    const response = await fetch(url);
    const html = await response.text();
    res.send(html);
  } catch (err) {
    console.error("Error fetching data:", err.message);
    res.status(500).send("Failed to fetch race data");
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
