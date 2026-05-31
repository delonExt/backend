const express = require('express');
const axios = require('axios');
const { pool } = require('../db/database');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

// Helper to format dates to local YYYY-MM-DD strings without timezone shifting
function formatDateLocal(date) {
  if (!date) return null;
  if (typeof date === 'string' && date.length === 10) return date;
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// POST /api/predictions — Get new prediction from ML service
router.post('/', authenticateToken, async (req, res) => {
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

      const nextDateStr = formatDateLocal(nextDate);

      // Save prediction even in simple average case for history tracking
      const [result] = await pool.execute(
        `INSERT INTO predictions (user_id, predicted_next_date, predicted_cycle_length, confidence, model_version)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.id,
          nextDateStr,
          avgCycle,
          0.5,
          'simple_average'
        ]
      );

      return res.json({
        id: result.insertId,
        predicted_next_date: nextDateStr,
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
        const logDate = formatDateLocal(log.date);
        const startStr = formatDateLocal(start);
        if (!end) return logDate >= startStr;
        const endStr = formatDateLocal(end);
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

      const nextDateStr = formatDateLocal(nextDate);

      // Save prediction
      const [result] = await pool.execute(
        `INSERT INTO predictions (user_id, predicted_next_date, predicted_cycle_length, confidence, model_version)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.id,
          nextDateStr,
          prediction.predicted_cycle_length,
          prediction.confidence,
          prediction.model_version || '1.0'
        ]
      );

      res.json({
        id: result.insertId,
        predicted_next_date: nextDateStr,
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

      const nextDateStr = formatDateLocal(nextDate);

      // Save prediction even in fallback case for history tracking
      const [result] = await pool.execute(
        `INSERT INTO predictions (user_id, predicted_next_date, predicted_cycle_length, confidence, model_version)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.id,
          nextDateStr,
          avgCycle,
          0.6,
          'fallback_average'
        ]
      );

      res.json({
        id: result.insertId,
        predicted_next_date: nextDateStr,
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

// GET /api/predictions/latest — Get latest saved prediction
router.get('/latest', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No predictions found' });
    }

    const prediction = rows[0];
    prediction.predicted_next_date = formatDateLocal(prediction.predicted_next_date);

    res.json(prediction);
  } catch (err) {
    console.error('Get latest prediction error:', err);
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

    const formattedPredictions = predictions.map(p => ({
      ...p,
      predicted_next_date: formatDateLocal(p.predicted_next_date)
    }));

    res.json(formattedPredictions);
  } catch (err) {
    console.error('Get prediction history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
