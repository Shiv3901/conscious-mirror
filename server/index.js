const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run("CREATE TABLE messages (id TEXT, content TEXT, timestamp TEXT)");
});

app.post('/message', (req, res) => {
  const { content } = req.body;
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  db.run("INSERT INTO messages VALUES (?, ?, ?)", [id, content, timestamp]);
  res.json({ status: 'ok', id });
});

app.get('/messages', (req, res) => {
  db.all("SELECT * FROM messages ORDER BY timestamp DESC", [], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});