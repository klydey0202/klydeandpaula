import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("wedding.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    data TEXT
  );
  CREATE TABLE IF NOT EXISTS rsvps (
    id TEXT PRIMARY KEY,
    name TEXT,
    contact TEXT,
    attending INTEGER,
    mealPreference TEXT,
    guestCount INTEGER,
    timestamp INTEGER,
    seatNumber TEXT
  );
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    name TEXT,
    message TEXT,
    photo TEXT,
    timestamp INTEGER
  );
  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    rsvpId TEXT,
    photo TEXT,
    timestamp INTEGER
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

const contentRow = db.prepare("SELECT data FROM content WHERE id = 'main'").get();
if (!contentRow) {
  db.prepare("INSERT INTO content (id, data) VALUES ('main', ?)").run(JSON.stringify(defaultContent));
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // ✅ Allow Netlify
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

  // API Routes
  app.get("/api/content", (req, res) => {
    const row = db.prepare("SELECT data FROM content WHERE id = 'main'").get() as any;
    res.json(JSON.parse(row.data));
  });

  app.post("/api/content", (req, res) => {
    db.prepare("UPDATE content SET data = ? WHERE id = 'main'").run(JSON.stringify(req.body));
    broadcast({ type: "content_update", data: req.body });
    res.json({ success: true });
  });

  app.get("/api/rsvps", (req, res) => {
    const rows = db.prepare("SELECT * FROM rsvps ORDER BY timestamp DESC").all();
    res.json(rows.map((r: any) => ({ ...r, attending: !!r.attending })));
  });

  app.post("/api/rsvps", (req, res) => {
    const rsvp = req.body;
    db.prepare(`
      INSERT INTO rsvps (id, name, contact, attending, mealPreference, guestCount, timestamp, seatNumber)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(rsvp.id, rsvp.name, rsvp.contact, rsvp.attending ? 1 : 0, rsvp.mealPreference, rsvp.guestCount, rsvp.timestamp, rsvp.seatNumber || null);
    broadcast({ type: "rsvp_new", data: rsvp });
    res.json({ success: true });
  });

  app.put("/api/rsvps/:id", (req, res) => {
    const rsvp = req.body;
    db.prepare(`
      UPDATE rsvps SET name = ?, contact = ?, attending = ?, mealPreference = ?, guestCount = ?, seatNumber = ?
      WHERE id = ?
    `).run(rsvp.name, rsvp.contact, rsvp.attending ? 1 : 0, rsvp.mealPreference, rsvp.guestCount, rsvp.seatNumber, req.params.id);
    broadcast({ type: "rsvp_update", data: rsvp });
    res.json({ success: true });
  });

  app.delete("/api/rsvps/:id", (req, res) => {
    db.prepare("DELETE FROM rsvps WHERE id = ?").run(req.params.id);
    broadcast({ type: "rsvp_delete", id: req.params.id });
    res.json({ success: true });
  });

  app.get("/api/posts", (req, res) => {
    const rows = db.prepare("SELECT * FROM posts ORDER BY timestamp DESC").all();
    res.json(rows);
  });

  app.post("/api/posts", (req, res) => {
    const post = req.body;
    db.prepare(`
      INSERT INTO posts (id, name, message, photo, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(post.id, post.name, post.message, post.photo || null, post.timestamp);
    broadcast({ type: "post_new", data: post });
    res.json({ success: true });
  });

  app.get("/api/checkins", (req, res) => {
    const rows = db.prepare("SELECT * FROM checkins ORDER BY timestamp DESC").all();
    res.json(rows);
  });

  app.post("/api/checkins", (req, res) => {
    const checkin = req.body;
    db.prepare(`
      INSERT INTO checkins (id, rsvpId, photo, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(checkin.id, checkin.rsvpId, checkin.photo || null, checkin.timestamp);
    broadcast({ type: "checkin_new", data: checkin });
    res.json({ success: true });
  });

  // WebSocket broadcast
  function broadcast(message: any) {
    const payload = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

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
