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

// POST /api/cycles
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, cycle_length, period_length, flow_intensity, notes } = req.body;

    if (!start_date) {
      return res.status(400).json({ error: 'Start date is required' });
    }

    const formattedStart = formatDateLocal(start_date);
    const formattedEnd = formatDateLocal(end_date);

    const [result] = await pool.execute(
      `INSERT INTO menstrual_cycles (user_id, start_date, end_date, cycle_length, period_length, flow_intensity, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        formattedStart,
        formattedEnd,
        cycle_length || null,
        period_length || null,
        flow_intensity || 'medium',
        notes || null
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM menstrual_cycles WHERE id = ?', [result.insertId]);
    const cycle = rows[0];
    cycle.start_date = formatDateLocal(cycle.start_date);
    cycle.end_date = formatDateLocal(cycle.end_date);

    res.status(201).json({ message: 'Cycle added', cycle });
  } catch (err) {
    console.error('Add cycle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cycles
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [cycles] = await pool.execute(
      'SELECT * FROM menstrual_cycles WHERE user_id = ? ORDER BY start_date DESC',
      [req.user.id]
    );

    const formattedCycles = cycles.map(c => ({
      ...c,
      start_date: formatDateLocal(c.start_date),
      end_date: formatDateLocal(c.end_date)
    }));

    res.json(formattedCycles);
  } catch (err) {
    console.error('Get cycles error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/cycles/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM menstrual_cycles WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    const cycle = rows[0];
    cycle.start_date = formatDateLocal(cycle.start_date);
    cycle.end_date = formatDateLocal(cycle.end_date);

    res.json(cycle);
  } catch (err) {
    console.error('Get cycle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/cycles/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, cycle_length, period_length, flow_intensity, notes } = req.body;

    const [existing] = await pool.execute(
      'SELECT * FROM menstrual_cycles WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    const fields = [];
    const params = [];

    if (start_date !== undefined) {
      fields.push('start_date = ?');
      params.push(formatDateLocal(start_date));
    }
    if (end_date !== undefined) {
      fields.push('end_date = ?');
      params.push(formatDateLocal(end_date));
    }
    if (cycle_length !== undefined) {
      fields.push('cycle_length = ?');
      params.push(cycle_length);
    }
    if (period_length !== undefined) {
      fields.push('period_length = ?');
      params.push(period_length);
    }
    if (flow_intensity !== undefined) {
      fields.push('flow_intensity = ?');
      params.push(flow_intensity);
    }
    if (notes !== undefined) {
      fields.push('notes = ?');
      params.push(notes || null);
    }

    if (fields.length > 0) {
      params.push(req.params.id);
      params.push(req.user.id);
      await pool.execute(
        `UPDATE menstrual_cycles SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        params
      );
    }

    const [updated] = await pool.execute('SELECT * FROM menstrual_cycles WHERE id = ?', [req.params.id]);
    const cycle = updated[0];
    cycle.start_date = formatDateLocal(cycle.start_date);
    cycle.end_date = formatDateLocal(cycle.end_date);

    res.json({ message: 'Cycle updated', cycle });
  } catch (err) {
    console.error('Update cycle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/cycles/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM menstrual_cycles WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    res.json({ message: 'Cycle deleted' });
  } catch (err) {
    console.error('Delete cycle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
