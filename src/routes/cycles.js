const express = require('express');
const { pool } = require('../db/database');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// POST /api/cycles
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, cycle_length, period_length, flow_intensity, notes } = req.body;

    if (!start_date) {
      return res.status(400).json({ error: 'Start date is required' });
    }

    const [result] = await pool.execute(
      `INSERT INTO menstrual_cycles (user_id, start_date, end_date, cycle_length, period_length, flow_intensity, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        start_date,
        end_date || null,
        cycle_length || null,
        period_length || null,
        flow_intensity || 'medium',
        notes || null
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM menstrual_cycles WHERE id = ?', [result.insertId]);

    res.status(201).json({ message: 'Cycle added', cycle: rows[0] });
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

    res.json(cycles);
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

    res.json(rows[0]);
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

    await pool.execute(
      `UPDATE menstrual_cycles SET
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        cycle_length = COALESCE(?, cycle_length),
        period_length = COALESCE(?, period_length),
        flow_intensity = COALESCE(?, flow_intensity),
        notes = COALESCE(?, notes)
      WHERE id = ? AND user_id = ?`,
      [
        start_date || null, end_date || null, cycle_length || null,
        period_length || null, flow_intensity || null, notes || null,
        req.params.id, req.user.id
      ]
    );

    const [updated] = await pool.execute('SELECT * FROM menstrual_cycles WHERE id = ?', [req.params.id]);
    res.json({ message: 'Cycle updated', cycle: updated[0] });
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
