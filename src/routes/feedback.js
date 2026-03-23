const express = require('express');
const { pool } = require('../db/database');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// POST /api/feedback
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { prediction_id, accuracy_rating, actual_date, comments } = req.body;

    if (!accuracy_rating || accuracy_rating < 1 || accuracy_rating > 5) {
      return res.status(400).json({ error: 'Accuracy rating (1-5) is required' });
    }

    const [result] = await pool.execute(
      `INSERT INTO feedback (user_id, prediction_id, accuracy_rating, actual_date, comments)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.user.id,
        prediction_id || null,
        accuracy_rating,
        actual_date || null,
        comments || null
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM feedback WHERE id = ?', [result.insertId]);
    res.status(201).json({ message: 'Feedback submitted', feedback: rows[0] });
  } catch (err) {
    console.error('Add feedback error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/feedback
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [feedbacks] = await pool.execute(
      'SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json(feedbacks);
  } catch (err) {
    console.error('Get feedback error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
