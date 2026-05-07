// FaithBridge Capital — single web service for Render.
// Serves the static site from the project root and exposes /api/submit,
// which sends a welcome email to the lead and a new-lead notification
// to the founder via Resend.

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/submit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Render sits behind a proxy — needed for correct https detection / req.ip.
app.set('trust proxy', 1);

// Parse JSON bodies for /api/* routes. Cap at 50KB to avoid abuse.
app.use(express.json({ limit: '50kb' }));

// Tiny request logger — Render shows this in its log stream.
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Form submission endpoint. The Vercel-style handler exported from
// api/submit.js is fully compatible with Express request/response objects.
app.post('/api/submit', handler);
app.options('/api/submit', handler);

// Static site — index.html plus assets (Robin.png, ira.jpg, Banner.mp4, Cruise.mp4).
// `extensions: ['html']` lets /faq resolve to /faq.html if you ever add subpages.
app.use(
  express.static(__dirname, {
    extensions: ['html'],
    maxAge: '1h',
    setHeaders(res, filePath) {
      // Long-cache videos and images, short-cache HTML.
      if (/\.(mp4|webm|jpg|jpeg|png|webp|svg|woff2?)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30d
      } else if (/\.html?$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min
      }
    },
  })
);

// Health check for Render's uptime probes.
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// 404 fallback — serve index.html so deep-link refreshes still work.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FaithBridge Capital site listening on :${PORT}`);
});
