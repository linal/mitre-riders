const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'client')));

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

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});
