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

    // Fetch user details first
    const [userRows] = await pool.execute(
      'SELECT name, email FROM users WHERE id = ?',
      [userId]
    );
    const user = userRows[0] || { name: 'Pengguna YeoCycles', email: '' };

    let query = 'SELECT * FROM daily_logs WHERE user_id = ?';
    const params = [userId];

    if (range && (range === '3' || range === '6')) {
      const months = parseInt(range);
      query += ' AND date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)';
      params.push(months);
    }

    query += ' ORDER BY date DESC';

    const [rows] = await pool.execute(query, params);

    // Format as CSV with UTF-8 BOM for Excel compatibility
    let csvContent = '\uFEFF'; 
    
    // Title and User Meta Header Block
    csvContent += 'LAPORAN REKAM MEDIS HARIAN - YEOCYCLES\n';
    csvContent += `Nama Pengguna,"${user.name}"\n`;
    csvContent += `Email Terdaftar,"${user.email}"\n`;
    csvContent += `Tanggal Unduh,"${formatDateLocal(new Date())}"\n`;
    csvContent += `Rentang Laporan,"${range === 'all' ? 'Semua Riwayat' : `${range} Bulan Terakhir`}"\n`;
    csvContent += `Jumlah Catatan,"${rows.length} hari"\n\n`;

    // Column Headers
    csvContent += 'Tanggal,Mood (1-5),Kualitas Tidur (1-5),Tingkat Stres (1-5),Puasa,Gejala Fisik,Catatan Harian\n';

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
            // Translate symptoms to Indonesian for consistency if needed, or leave as logged
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
    res.setHeader('Content-Disposition', `attachment; filename=Laporan_YeoCycles_${user.name.replace(/[^a-z0-9]/gi, '_')}_${formatDateLocal(new Date())}.csv`);
    
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
