const express = require('express');
const { pool } = require('../db/database');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

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

// POST /api/daily-logs
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { date, mood, symptoms, sleep_quality, stress_level, is_fasting, notes } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const formattedDate = formatDateLocal(date);

    // Check if log already exists for this date
    const [existing] = await pool.execute(
      'SELECT id FROM daily_logs WHERE user_id = ? AND date = ?',
      [req.user.id, formattedDate]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Daily log already exists for this date. Use PUT /api/daily-logs/:date to update it.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO daily_logs (user_id, date, mood, symptoms, sleep_quality, stress_level, is_fasting, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        formattedDate,
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
    log.date = formatDateLocal(log.date);
    log.symptoms = log.symptoms ? JSON.parse(log.symptoms) : [];
    res.status(201).json({ message: 'Daily log created', log });
  } catch (err) {
    console.error('Add daily log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/daily-logs/:date
router.put('/:date', authenticateToken, async (req, res) => {
  try {
    const { mood, symptoms, sleep_quality, stress_level, is_fasting, notes } = req.body;
    const dateParam = formatDateLocal(req.params.date);

    // Check if log exists for this date
    const [existing] = await pool.execute(
      'SELECT id FROM daily_logs WHERE user_id = ? AND date = ?',
      [req.user.id, dateParam]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Daily log not found for this date. Use POST /api/daily-logs to create it.' });
    }

    const fields = [];
    const params = [];

    if (mood !== undefined) {
      fields.push('mood = ?');
      params.push(mood);
    }
    if (symptoms !== undefined) {
      fields.push('symptoms = ?');
      params.push(symptoms ? JSON.stringify(symptoms) : null);
    }
    if (sleep_quality !== undefined) {
      fields.push('sleep_quality = ?');
      params.push(sleep_quality);
    }
    if (stress_level !== undefined) {
      fields.push('stress_level = ?');
      params.push(stress_level);
    }
    if (is_fasting !== undefined) {
      fields.push('is_fasting = ?');
      params.push(is_fasting ? 1 : 0);
    }
    if (notes !== undefined) {
      fields.push('notes = ?');
      params.push(notes || null);
    }

    if (fields.length > 0) {
      params.push(existing[0].id);
      await pool.execute(
        `UPDATE daily_logs SET ${fields.join(', ')} WHERE id = ?`,
        params
      );
    }

    const [updated] = await pool.execute('SELECT * FROM daily_logs WHERE id = ?', [existing[0].id]);
    const log = updated[0];
    log.date = formatDateLocal(log.date);
    log.symptoms = log.symptoms ? JSON.parse(log.symptoms) : [];
    res.json({ message: 'Daily log updated successfully', log });
  } catch (err) {
    console.error('Update daily log error:', err);
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
      params.push(formatDateLocal(start_date));
    }
    if (end_date) {
      query += ' AND date <= ?';
      params.push(formatDateLocal(end_date));
    }

    query += ' ORDER BY date DESC';

    const [logs] = await pool.execute(query, params);
    const parsedLogs = logs.map(log => ({
      ...log,
      date: formatDateLocal(log.date),
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
    const dateParam = formatDateLocal(req.params.date);
    const [rows] = await pool.execute(
      'SELECT * FROM daily_logs WHERE user_id = ? AND date = ?',
      [req.user.id, dateParam]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Log not found for this date' });
    }

    const log = rows[0];
    log.date = formatDateLocal(log.date);
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
