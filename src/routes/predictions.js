const express = require('express');
const axios = require('axios');
const { pool } = require('../db/database');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

// GET /api/predictions — Get new prediction from ML service
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get user's cycle history
    const [cycles] = await pool.execute(
      'SELECT * FROM menstrual_cycles WHERE user_id = ? ORDER BY start_date ASC',
      [req.user.id]
    );

    if (cycles.length < 3) {
      // Not enough data — use simple average or default
      const avgCycle = cycles.length > 0
        ? Math.round(cycles.reduce((sum, c) => sum + (c.cycle_length || 28), 0) / cycles.length)
        : 28;

      const lastCycle = cycles[cycles.length - 1];
      const lastStart = lastCycle ? new Date(lastCycle.start_date) : new Date();
      const nextDate = new Date(lastStart);
      nextDate.setDate(nextDate.getDate() + avgCycle);

      return res.json({
        predicted_next_date: nextDate.toISOString().split('T')[0],
        predicted_cycle_length: avgCycle,
        confidence: 0.5,
        model_version: 'simple_average',
        message: 'Not enough cycle data for ML prediction. Using simple average. Log at least 3 cycles for better predictions.'
      });
    }

    // Get daily log data for context
    const [dailyLogs] = await pool.execute(
      'SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date ASC',
      [req.user.id]
    );

    // Prepare data for ML service
    const cycleLengths = cycles.map(c => c.cycle_length || 28);
    const sleepAvgs = [];
    const stressAvgs = [];
    const fastingDays = [];

    // Aggregate daily logs per cycle
    for (let i = 0; i < cycles.length; i++) {
      const start = cycles[i].start_date;
      const end = cycles[i].end_date || (cycles[i + 1] ? cycles[i + 1].start_date : null);

      const cycleLogs = dailyLogs.filter(log => {
        const logDate = typeof log.date === 'string' ? log.date : new Date(log.date).toISOString().split('T')[0];
        const startStr = typeof start === 'string' ? start : new Date(start).toISOString().split('T')[0];
        if (!end) return logDate >= startStr;
        const endStr = typeof end === 'string' ? end : new Date(end).toISOString().split('T')[0];
        return logDate >= startStr && logDate < endStr;
      });

      sleepAvgs.push(cycleLogs.length > 0
        ? cycleLogs.reduce((s, l) => s + (l.sleep_quality || 3), 0) / cycleLogs.length
        : 3);
      stressAvgs.push(cycleLogs.length > 0
        ? cycleLogs.reduce((s, l) => s + (l.stress_level || 3), 0) / cycleLogs.length
        : 3);
      fastingDays.push(cycleLogs.filter(l => l.is_fasting).length);
    }

    try {
      // Call ML service
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
        cycles: cycleLengths,
        sleep: sleepAvgs,
        stress: stressAvgs,
        fasting: fastingDays
      }, { timeout: 10000 });

      const prediction = mlResponse.data;

      // Calculate predicted next date
      const lastCycle = cycles[cycles.length - 1];
      const lastStart = new Date(lastCycle.start_date);
      const nextDate = new Date(lastStart);
      nextDate.setDate(nextDate.getDate() + (prediction.predicted_cycle_length || 28));

      // Save prediction
      const [result] = await pool.execute(
        `INSERT INTO predictions (user_id, predicted_next_date, predicted_cycle_length, confidence, model_version)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.id,
          nextDate.toISOString().split('T')[0],
          prediction.predicted_cycle_length,
          prediction.confidence,
          prediction.model_version || '1.0'
        ]
      );

      res.json({
        id: result.insertId,
        predicted_next_date: nextDate.toISOString().split('T')[0],
        predicted_cycle_length: prediction.predicted_cycle_length,
        confidence: prediction.confidence,
        model_version: prediction.model_version || '1.0'
      });
    } catch (mlError) {
      // ML service unavailable — fallback to simple average
      console.warn('ML service unavailable, using fallback:', mlError.message);
      const avgCycle = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);
      const lastCycle = cycles[cycles.length - 1];
      const lastStart = new Date(lastCycle.start_date);
      const nextDate = new Date(lastStart);
      nextDate.setDate(nextDate.getDate() + avgCycle);

      res.json({
        predicted_next_date: nextDate.toISOString().split('T')[0],
        predicted_cycle_length: avgCycle,
        confidence: 0.6,
        model_version: 'fallback_average',
        message: 'ML service is unavailable. Using cycle average as fallback.'
      });
    }
  } catch (err) {
    console.error('Prediction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/predictions/history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const [predictions] = await pool.execute(
      'SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );

    res.json(predictions);
  } catch (err) {
    console.error('Get prediction history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
