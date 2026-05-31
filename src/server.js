require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const cycleRoutes = require('./routes/cycles');
const dailyLogRoutes = require('./routes/dailyLogs');
const predictionRoutes = require('./routes/predictions');
const feedbackRoutes = require('./routes/feedback');
const insightsRoutes = require('./routes/insights');
const analyticsRoutes = require('./routes/analytics');
const exportRoutes = require('./routes/export');

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/cycles', cycleRoutes);
app.use('/api/daily-logs', dailyLogRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
