const express = require('express');
const { pool } = require('../db/database');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Helper to format dates to local YYYY-MM-DD
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

// GET /api/analytics/trends
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch cycle data
    const [cycles] = await pool.execute(
      'SELECT * FROM menstrual_cycles WHERE user_id = ? ORDER BY start_date DESC',
      [userId]
    );

    let cycleStats = {
      totalCycles: cycles.length,
      avgCycleLength: 0,
      avgPeriodLength: 0,
      minCycleLength: 0,
      maxCycleLength: 0,
      regularityScore: 0,
      regularityStatus: 'Belum Cukup Data'
    };

    const formattedCycles = cycles.map(c => ({
      ...c,
      start_date: formatDateLocal(c.start_date),
      end_date: formatDateLocal(c.end_date)
    }));

    if (cycles.length > 0) {
      let cycleLengths = [];
      let periodLengths = [];

      cycles.forEach(c => {
        if (c.cycle_length) cycleLengths.push(c.cycle_length);
        if (c.period_length) periodLengths.push(c.period_length);
      });

      // Averages
      const sumCycle = cycleLengths.reduce((a, b) => a + b, 0);
      const sumPeriod = periodLengths.reduce((a, b) => a + b, 0);
      
      cycleStats.avgCycleLength = cycleLengths.length > 0 ? parseFloat((sumCycle / cycleLengths.length).toFixed(1)) : 28;
      cycleStats.avgPeriodLength = periodLengths.length > 0 ? parseFloat((sumPeriod / periodLengths.length).toFixed(1)) : 5;
      
      cycleStats.minCycleLength = cycleLengths.length > 0 ? Math.min(...cycleLengths) : 0;
      cycleStats.maxCycleLength = cycleLengths.length > 0 ? Math.max(...cycleLengths) : 0;

      // Regularity Score (Standard Deviation of cycle lengths)
      if (cycleLengths.length >= 2) {
        const mean = sumCycle / cycleLengths.length;
        const variance = cycleLengths.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / cycleLengths.length;
        const stdDev = Math.sqrt(variance);
        cycleStats.regularityScore = parseFloat(stdDev.toFixed(2));

        if (stdDev < 2) {
          cycleStats.regularityStatus = 'Sangat Teratur';
        } else if (stdDev <= 5) {
          cycleStats.regularityStatus = 'Teratur';
        } else {
          cycleStats.regularityStatus = 'Tidak Teratur';
        }
      } else if (cycleLengths.length === 1) {
        cycleStats.regularityStatus = 'Teratur';
      }
    }

    // 2. Fetch daily logs for trend analysis (up to last 30 logs)
    const [logs] = await pool.execute(
      'SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date DESC LIMIT 30',
      [userId]
    );

    // Pearson Correlation coefficient calculation (sleep vs stress)
    let correlation = {
      pearsonR: 0,
      status: 'Kurang Data',
      message: 'Catat tingkat stres dan kualitas tidur secara konsisten untuk melihat korelasi gaya hidup Anda.'
    };

    const moodFreq = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const symptomFreq = {};
    const lifestyleTrends = [];

    let sleepValues = [];
    let stressValues = [];

    logs.forEach(l => {
      const formattedDate = formatDateLocal(l.date);
      
      // Store log for trend line chart
      lifestyleTrends.push({
        date: formattedDate,
        sleep: l.sleep_quality,
        stress: l.stress_level,
        mood: l.mood
      });

      // Mood frequency
      if (l.mood && moodFreq[l.mood] !== undefined) {
        moodFreq[l.mood]++;
      }

      // Sleep & Stress lists for correlation
      if (l.sleep_quality !== null && l.stress_level !== null) {
        sleepValues.push(l.sleep_quality);
        stressValues.push(l.stress_level);
      }

      // Symptom frequency
      if (l.symptoms) {
        try {
          const symptomsList = JSON.parse(l.symptoms);
          if (Array.isArray(symptomsList)) {
            symptomsList.forEach(s => {
              symptomFreq[s] = (symptomFreq[s] || 0) + 1;
            });
          }
        } catch (e) {
          console.error('Error parsing symptom details:', e);
        }
      }
    });

    // Reverse trends to show chronological order
    lifestyleTrends.reverse();

    // Pearson Calculation
    const n = sleepValues.length;
    if (n >= 4) {
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
      for (let i = 0; i < n; i++) {
        const x = sleepValues[i];
        const y = stressValues[i];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        sumY2 += y * y;
      }
      
      const num = (n * sumXY) - (sumX * sumY);
      const den = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
      
      const r = den !== 0 ? parseFloat((num / den).toFixed(2)) : 0;
      correlation.pearsonR = r;

      if (r <= -0.5) {
        correlation.status = 'Korelasi Negatif Kuat 📉';
        correlation.message = 'Analisis menunjukkan bahwa stres tinggi secara langsung berakibat pada kualitas tidur yang buruk. Usahakan latihan relaksasi malam hari.';
      } else if (r < -0.1) {
        correlation.status = 'Korelasi Negatif Ringan 📉';
        correlation.message = 'Kualitas tidur Anda cenderung sedikit menurun saat hari-hari penuh stres. Cobalah tidur di jam yang lebih teratur.';
      } else if (r >= 0.5) {
        correlation.status = 'Korelasi Positif Kuat 📈';
        correlation.message = 'Terdapat hubungan positif antara ketenangan dan tidur nyenyak Anda.';
      } else {
        correlation.status = 'Korelasi Netral ⚖️';
        correlation.message = 'Tingkat stres dan tidur Anda berfluktuasi secara independen. Pola hidup Anda saat ini relatif seimbang.';
      }
    }

    // Convert symptom frequencies to structured array
    const sortedSymptoms = Object.keys(symptomFreq).map(name => ({
      name,
      count: symptomFreq[name]
    })).sort((a, b) => b.count - a.count);

    res.json({
      cycleStats,
      recentCyclesList: formattedCycles.slice(0, 6),
      correlation,
      symptomDistribution: sortedSymptoms,
      moodDistribution: moodFreq,
      lifestyleTrends
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
