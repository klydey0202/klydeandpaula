import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize DB tables
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content (
      id TEXT PRIMARY KEY,
      data TEXT
    );
    CREATE TABLE IF NOT EXISTS rsvps (
      id TEXT PRIMARY KEY,
      name TEXT,
      contact TEXT,
      attending BOOLEAN,
      "mealPreference" TEXT,
      "guestCount" INTEGER,
      timestamp BIGINT,
      "seatNumber" TEXT
    );
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      name TEXT,
      message TEXT,
      photo TEXT,
      timestamp BIGINT
    );
    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY,
      "rsvpId" TEXT,
      photo TEXT,
      timestamp BIGINT
    );
  `);

  // Default content if not exists
  const defaultContent = {
    coupleNames: "Klyde & Paula",
    weddingDate: "November 20, 2026",
    hashtag: "#KlydeAndPaula2026",
    heroTitle: "The Beginning of Forever",
    heroSubtitle: "We're getting married!",
    ceremonyVenue: "Iglesia Ni Cristo, Lokal ng San Francisco",
    ceremonyAddress: "#1039 Del Monte Ave, San Francisco del Monte, Quezon City",
    ceremonyTime: "2:00 PM",
    receptionVenue: "Stalla Suites Event Place",
    receptionAddress: "1008 Quezon Ave, Paligsahan, Diliman, Quezon City",
    receptionTime: "4:00 PM",
    parkingNote: "First 50 vehicles, first come first serve.",
    attireText: "We'd love to see you in our warm motif! Think rusty oranges, terracotta, and earthy tones.",
    giftText: "We're so excited to celebrate with you! While your presence is the only gift we need, if you're feeling extra generous, a contribution to our 'New Home & Travel' fund would be absolutely amazing. We've already got enough toasters to open a bakery!",
    adminPassword: "klydeandpaula2026",
  };

  const existing = await pool.query("SELECT id FROM content WHERE id = 'main'");
  if (existing.rows.length === 0) {
    await pool.query(
      "INSERT INTO content (id, data) VALUES ('main', $1)",
      [JSON.stringify(defaultContent)]
    );
  }
}

async function startServer() {
  await initDB();

  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Allow Netlify
  app.use(cors({
    origin: [
      'https://klypauthewedding.netlify.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

  app.use(express.json({ limit: '50mb' }));

  // WebSocket broadcast
  function broadcast(message: any) {
    const payload = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  // --- API Routes ---

  // Content
  app.get("/api/content", async (req, res) => {
    const row = await pool.query("SELECT data FROM content WHERE id = 'main'");
    res.json(JSON.parse(row.rows[0].data));
  });

  app.post("/api/content", async (req, res) => {
    await pool.query(
      "UPDATE content SET data = $1 WHERE id = 'main'",
      [JSON.stringify(req.body)]
    );
    broadcast({ type: "content_update", data: req.body });
    res.json({ success: true });
  });

  // RSVPs
  app.get("/api/rsvps", async (req, res) => {
    const rows = await pool.query('SELECT * FROM rsvps ORDER BY timestamp DESC');
    res.json(rows.rows);
  });

  app.post("/api/rsvps", async (req, res) => {
    const rsvp = req.body;
    await pool.query(`
      INSERT INTO rsvps (id, name, contact, attending, "mealPreference", "guestCount", timestamp, "seatNumber")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [rsvp.id, rsvp.name, rsvp.contact, rsvp.attending, rsvp.mealPreference, rsvp.guestCount, rsvp.timestamp, rsvp.seatNumber || null]);
    broadcast({ type: "rsvp_new", data: rsvp });
    res.json({ success: true });
  });

  app.put("/api/rsvps/:id", async (req, res) => {
    const rsvp = req.body;
    await pool.query(`
      UPDATE rsvps SET name = $1, contact = $2, attending = $3, "mealPreference" = $4, "guestCount" = $5, "seatNumber" = $6
      WHERE id = $7
    `, [rsvp.name, rsvp.contact, rsvp.attending, rsvp.mealPreference, rsvp.guestCount, rsvp.seatNumber, req.params.id]);
    broadcast({ type: "rsvp_update", data: rsvp });
    res.json({ success: true });
  });

  app.delete("/api/rsvps/:id", async (req, res) => {
    await pool.query("DELETE FROM rsvps WHERE id = $1", [req.params.id]);
    broadcast({ type: "rsvp_delete", id: req.params.id });
    res.json({ success: true });
  });

  // Posts
  app.get("/api/posts", async (req, res) => {
    const rows = await pool.query('SELECT * FROM posts ORDER BY timestamp DESC');
    res.json(rows.rows);
  });

  app.post("/api/posts", async (req, res) => {
    const post = req.body;
    await pool.query(`
      INSERT INTO posts (id, name, message, photo, timestamp)
      VALUES ($1, $2, $3, $4, $5)
    `, [post.id, post.name, post.message, post.photo || null, post.timestamp]);
    broadcast({ type: "post_new", data: post });
    res.json({ success: true });
  });

  // Checkins
  app.get("/api/checkins", async (req, res) => {
    const rows = await pool.query('SELECT * FROM checkins ORDER BY timestamp DESC');
    res.json(rows.rows);
  });

  app.post("/api/checkins", async (req, res) => {
    const checkin = req.body;
    await pool.query(`
      INSERT INTO checkins (id, "rsvpId", photo, timestamp)
      VALUES ($1, $2, $3, $4)
    `, [checkin.id, checkin.rsvpId, checkin.photo || null, checkin.timestamp]);
    broadcast({ type: "checkin_new", data: checkin });
    res.json({ success: true });
  });

  wss.on("connection", (ws) => {
    console.log("Client connected");
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = parseInt(process.env.PORT || "3001", 10);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();