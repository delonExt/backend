const express = require('express');
const { pool } = require('../db/database');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// POST /api/daily-logs
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { date, mood, symptoms, sleep_quality, stress_level, is_fasting, notes } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Check if log already exists for this date
    const [existing] = await pool.execute(
      'SELECT id FROM daily_logs WHERE user_id = ? AND date = ?',
      [req.user.id, date]
    );

    if (existing.length > 0) {
      // Update existing log
      await pool.execute(
        `UPDATE daily_logs SET
          mood = COALESCE(?, mood),
          symptoms = COALESCE(?, symptoms),
          sleep_quality = COALESCE(?, sleep_quality),
          stress_level = COALESCE(?, stress_level),
          is_fasting = COALESCE(?, is_fasting),
          notes = COALESCE(?, notes)
        WHERE id = ?`,
        [
          mood || null,
          symptoms ? JSON.stringify(symptoms) : null,
          sleep_quality || null,
          stress_level || null,
          is_fasting !== undefined ? (is_fasting ? 1 : 0) : null,
          notes || null,
          existing[0].id
        ]
      );

      const [updated] = await pool.execute('SELECT * FROM daily_logs WHERE id = ?', [existing[0].id]);
      const log = updated[0];
      log.symptoms = log.symptoms ? JSON.parse(log.symptoms) : [];
      return res.json({ message: 'Daily log updated', log });
    }

    const [result] = await pool.execute(
      `INSERT INTO daily_logs (user_id, date, mood, symptoms, sleep_quality, stress_level, is_fasting, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        date,
        mood || null,
        symptoms ? JSON.stringify(symptoms) : null,
        sleep_quality || null,
        stress_level || null,
        is_fasting ? 1 : 0,
        notes || null
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM daily_logs WHERE id = ?', [result.insertId]);
    const log = rows[0];
    log.symptoms = log.symptoms ? JSON.parse(log.symptoms) : [];
    res.status(201).json({ message: 'Daily log created', log });
  } catch (err) {
    console.error('Add daily log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/daily-logs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = 'SELECT * FROM daily_logs WHERE user_id = ?';
    const params = [req.user.id];

    if (start_date) {
      query += ' AND date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY date DESC';

    const [logs] = await pool.execute(query, params);
    const parsedLogs = logs.map(log => ({
      ...log,
      symptoms: log.symptoms ? JSON.parse(log.symptoms) : []
    }));
    res.json(parsedLogs);
  } catch (err) {
    console.error('Get daily logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/daily-logs/:date
router.get('/:date', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM daily_logs WHERE user_id = ? AND date = ?',
      [req.user.id, req.params.date]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Log not found for this date' });
    }

    const log = rows[0];
    log.symptoms = log.symptoms ? JSON.parse(log.symptoms) : [];
    res.json(log);
  } catch (err) {
    console.error('Get daily log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/daily-logs/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM daily_logs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json({ message: 'Daily log deleted' });
  } catch (err) {
    console.error('Delete daily log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
