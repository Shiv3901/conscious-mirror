require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const winston = require('winston');

const app = express();
const port = 5000;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

logger.info("Starting server setup...");

// Middleware
app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run("CREATE TABLE messages (id TEXT, content TEXT, timestamp TEXT)", err => {
    if (err) {
      logger.error("DB table creation failed: " + err.message);
    } else {
      logger.info("SQLite DB initialized with messages table.");
    }
  });
});

// Endpoints
app.post('/message', (req, res) => {
  const { content } = req.body;
  const id = uuidv4();
  const timestamp = new Date().toISOString();

  db.run("INSERT INTO messages VALUES (?, ?, ?)", [id, content, timestamp], (err) => {
    if (err) {
      logger.error("Failed to insert message: " + err.message);
      return res.status(500).send("DB error");
    }
    logger.info(`Message stored: ${content}`);
    res.json({ status: 'ok', id });
  });
});

app.get('/messages', (req, res) => {
  db.all("SELECT * FROM messages ORDER BY timestamp DESC", [], (err, rows) => {
    if (err) {
      logger.error("Failed to fetch messages: " + err.message);
      return res.status(500).send(err);
    }
    logger.info(`Fetched ${rows.length} messages`);
    res.json(rows);
  });
});

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get('/summary/today', async (req, res) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  logger.info(`Summary request for messages between ${start.toISOString()} and ${end.toISOString()}`);

  db.all(
    "SELECT * FROM messages WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC",
    [start.toISOString(), end.toISOString()],
    async (err, rows) => {
      if (err) {
        logger.error("DB query failed: " + err.message);
        return res.status(500).send(err);
      }

      if (rows.length === 0) {
        logger.info("No messages to summarize for today.");
        return res.json({ summary: "No messages today." });
      }

      const messageList = rows.map(r => `- ${r.content}`).join('\n');

      try {
        logger.info(`Sending ${rows.length} messages to OpenAI for summarization...`);

        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a neutral reflective mirror. You do not judge, advise, praise, or criticize. Summarize key themes and patterns from user thoughts without emotion or opinion.",
            },
            {
              role: "user",
              content: `Here are the user's thoughts from today:\n\n${messageList}`,
            }
          ]
        });

        const summary = response.choices[0].message.content.trim();
        logger.info("Summary generated successfully.");
        res.json({ summary });

      } catch (apiErr) {
        logger.error("OpenAI summarization failed:");
        if (apiErr.response) {
          logger.error(JSON.stringify(apiErr.response.data, null, 2));
        } else {
          logger.error(apiErr.message);
        }
        res.status(500).json({ error: "LLM summarization failed." });
      }
    }
  );
});

// Start server
app.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});