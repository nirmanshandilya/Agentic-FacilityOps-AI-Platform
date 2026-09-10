const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const connectDB = require('./config/db');

const facilityRoutes = require('./routes/facilityRoutes');
const energyRoutes = require('./routes/energyRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');

const app = express();

// ---------- Middleware ----------
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// ---------- Health check ----------
app.get('/api/health', (req, res) => {
  res.json({ success: true, service: 'facilityops-backend', status: 'ok', env: env.nodeEnv });
});

// ---------- Routes ----------
// Mounted under /api so future agent modules (Maintenance, Security,
// Occupancy, Cost) can each register their own /api/<domain> router
// without touching this file's structure.
app.use('/api/facilities', facilityRoutes);
app.use('/api/energy', energyRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// ---------- 404 handler ----------
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ---------- Global error handler ----------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`[server] FacilityOps backend running on http://localhost:${env.port}`);
    console.log(`[server] CORS origin: ${env.clientOrigin}`);
  });
}

start();

module.exports = app;
