const express = require('express');
const { pool } = require('../db/database');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// GET /api/profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, date_of_birth, avg_cycle_length, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/profile
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { name, date_of_birth, avg_cycle_length } = req.body;

    await pool.execute(
      'UPDATE users SET name = COALESCE(?, name), date_of_birth = COALESCE(?, date_of_birth), avg_cycle_length = COALESCE(?, avg_cycle_length) WHERE id = ?',
      [name || null, date_of_birth || null, avg_cycle_length || null, req.user.id]
    );

    const [rows] = await pool.execute(
      'SELECT id, name, email, date_of_birth, avg_cycle_length, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({ message: 'Profile updated', user: rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
