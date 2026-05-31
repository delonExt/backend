const express = require('express');
const { pool } = require('../db/database');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Helper to format dates to local YYYY-MM-DD
function formatDateLocal(date) {
  if (!date) return '';
  if (typeof date === 'string' && date.length === 10) return date;
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// GET /api/export/csv
router.get('/csv', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { range } = req.query; // '3', '6', or 'all'

    let query = 'SELECT * FROM daily_logs WHERE user_id = ?';
    const params = [userId];

    if (range && (range === '3' || range === '6')) {
      const months = parseInt(range);
      query += ' AND date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)';
      params.push(months);
    }

    query += ' ORDER BY date DESC';

    const [rows] = await pool.execute(query, params);

    // Format as CSV
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    csvContent += 'Tanggal,Mood (1-5),Kualitas Tidur (1-5),Tingkat Stres (1-5),Puasa,Gejala,Catatan\n';

    rows.forEach(log => {
      const date = formatDateLocal(log.date);
      const mood = log.mood || '';
      const sleep = log.sleep_quality || '';
      const stress = log.stress_level || '';
      const fasting = log.is_fasting ? 'Ya' : 'Tidak';
      
      // Parse symptoms list
      let symptomsStr = '';
      if (log.symptoms) {
        try {
          const arr = JSON.parse(log.symptoms);
          if (Array.isArray(arr)) {
            symptomsStr = arr.join('; ');
          }
        } catch (e) {
          symptomsStr = '';
        }
      }

      // Escape quotes in notes and wrap in double quotes
      let notes = log.notes || '';
      notes = notes.replace(/"/g, '""');

      csvContent += `${date},${mood},${sleep},${stress},${fasting},"${symptomsStr}","${notes}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=Laporan_Kesehatan_YeoCycles_${formatDateLocal(new Date())}.csv`);
    
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
