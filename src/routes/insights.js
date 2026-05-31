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

// GET /api/insights/self-care
router.get('/self-care', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get latest cycle to calculate current cycle phase
    const [cycleRows] = await pool.execute(
      'SELECT * FROM menstrual_cycles WHERE user_id = ? ORDER BY start_date DESC LIMIT 1',
      [userId]
    );

    let cyclePhase = {
      name: 'Fase Tidak Diketahui',
      day: null,
      description: 'Catat tanggal mulai siklus haid terakhir Anda di tab Cycles untuk menganalisis fase siklus saat ini.',
      tips: ['Mulai catat log harian dan siklus menstruasimu untuk rekomendasi yang dipersonalisasi.']
    };

    let dayOfCycle = null;

    if (cycleRows.length > 0) {
      const latestCycle = cycleRows[0];
      const startDate = new Date(latestCycle.start_date);
      const today = new Date();
      
      // Calculate difference in days (ignoring hours)
      const diffTime = today.setHours(0,0,0,0) - startDate.setHours(0,0,0,0);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      const cycleLength = latestCycle.cycle_length || 28;

      if (diffDays >= 1) {
        dayOfCycle = ((diffDays - 1) % cycleLength) + 1;

        if (dayOfCycle <= 5) {
          cyclePhase = {
            name: 'Fase Menstruasi',
            day: dayOfCycle,
            description: 'Hari pertama siklus Anda dimulai di sini. Lapisan rahim meluruh, yang sering kali disertai kram perut dan kelelahan.',
            tips: [
              'Minum air jahe hangat untuk meredakan kram perut.',
              'Konsumsi makanan kaya zat besi seperti bayam, brokoli, dan daging merah tanpa lemak.',
              'Fokus pada peregangan otot ringan atau yoga pemulihan.'
            ]
          };
        } else if (dayOfCycle <= 13) {
          cyclePhase = {
            name: 'Fase Folikular',
            day: dayOfCycle,
            description: 'Hormon estrogen mulai meningkat, meningkatkan energi, fokus, dan mood Anda secara alami.',
            tips: [
              'Konsumsi makanan fermentasi (seperti tempe atau yogurt) untuk mendukung metabolisme estrogen.',
              'Manfaatkan energi ekstra ini untuk latihan kekuatan fisik atau olahraga kardio.',
              'Waktu yang sangat baik untuk mempelajari hal baru atau merencanakan proyek penting.'
            ]
          };
        } else if (dayOfCycle <= 15) {
          cyclePhase = {
            name: 'Fase Ovulasi',
            day: dayOfCycle,
            description: 'Fase pelepasan sel telur. Energi dan kepercayaan diri Anda berada pada puncaknya.',
            tips: [
              'Pertahankan hidrasi tubuh yang optimal dengan minum setidaknya 2-3 liter air.',
              'Nikmati olahraga intensitas tinggi seperti kardio, HIIT, atau lari.',
              'Konsumsi makanan segar dan buah-buahan yang kaya antioksidan.'
            ]
          };
        } else {
          cyclePhase = {
            name: 'Fase Luteal',
            day: dayOfCycle,
            description: 'Persiapan tubuh sebelum menstruasi berikutnya. Hormon progesteron meningkat, yang kadang memicu gejala PMS (premenstrual syndrome).',
            tips: [
              'Konsumsi makanan kaya magnesium seperti cokelat hitam, pisang, dan kacang-kacangan untuk mencegah mood swing.',
              'Kurangi makanan asin dan junk food untuk meminimalkan penahanan air (kembung).',
              'Lakukan olahraga ringan seperti jalan kaki santai atau meditasi untuk menenangkan saraf.'
            ]
          };
        }
      }
    }

    // 2. Get past 7 daily logs to calculate averages & symptom frequencies
    const [logRows] = await pool.execute(
      'SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date DESC LIMIT 7',
      [userId]
    );

    let totalStress = 0;
    let totalSleep = 0;
    let stressCount = 0;
    let sleepCount = 0;
    const symptomCounts = {};
    let latestLog = null;

    if (logRows.length > 0) {
      latestLog = logRows[0];
      logRows.forEach(log => {
        if (log.stress_level) {
          totalStress += log.stress_level;
          stressCount++;
        }
        if (log.sleep_quality) {
          totalSleep += log.sleep_quality;
          sleepCount++;
        }
        if (log.symptoms) {
          try {
            const symptoms = JSON.parse(log.symptoms);
            if (Array.isArray(symptoms)) {
              symptoms.forEach(s => {
                symptomCounts[s] = (symptomCounts[s] || 0) + 1;
              });
            }
          } catch (e) {
            console.error('Error parsing symptoms JSON:', e);
          }
        }
      });
    }

    const avgStress = stressCount > 0 ? parseFloat((totalStress / stressCount).toFixed(1)) : null;
    const avgSleep = sleepCount > 0 ? parseFloat((totalSleep / sleepCount).toFixed(1)) : null;

    // Convert symptomCounts to sorted list
    const topSymptoms = Object.keys(symptomCounts).map(name => ({
      name,
      count: symptomCounts[name]
    })).sort((a, b) => b.count - a.count);

    // 3. Dynamic recommendations based on logs and current phase
    const recommendations = [];

    // Diet & Hydration Recommendation
    let dietRec = {
      type: 'diet',
      title: 'Nutrisi & Hidrasi 🍎',
      content: 'Pertahankan diet seimbang dengan memperbanyak serat dari sayuran dan buah segar. Pastikan asupan air putih minimal 2 liter per hari.'
    };

    if (symptomCounts['bloating'] || symptomCounts['kembung']) {
      dietRec.content = 'Untuk meredakan kembung, kurangi konsumsi garam dan makanan olahan. Minum teh peppermint hangat atau air infus mentimun dapat membantu.';
    } else if (cyclePhase.name === 'Fase Menstruasi') {
      dietRec.content = 'Tubuh membutuhkan zat besi tambahan untuk menggantikan darah yang hilang. Konsumsi sayuran hijau gelap, daging tanpa lemak, dan hindari minum teh/kopi langsung setelah makan karena dapat menghambat penyerapan zat besi.';
    } else if (cyclePhase.name === 'Fase Luteal') {
      dietRec.content = 'Kurangi kafein dan gula berlebih untuk menekan tingkat keparahan kram perut dan ketidakstabilan mood. Konsumsi almond atau pisang yang tinggi magnesium.';
    }
    recommendations.push(dietRec);

    // Exercise / Physical Activity Recommendation
    let exerciseRec = {
      type: 'exercise',
      title: 'Aktivitas Fisik & Peregangan 🧘',
      content: 'Latihan fisik ringan secara teratur dapat merangsang pelepasan hormon endorfin yang meningkatkan mood dan meredakan nyeri tubuh.'
    };

    if (symptomCounts['cramps'] || symptomCounts['kram']) {
      exerciseRec.content = 'Hindari olahraga berat. Lakukan pose yoga ringan seperti pose anak balita (*Child\'s pose*) atau berbaring dengan kaki disandarkan ke dinding (*Legs-Up-The-Wall*) untuk merelaksasi panggul.';
    } else if (cyclePhase.name === 'Fase Ovulasi' || cyclePhase.name === 'Fase Folikular') {
      exerciseRec.content = 'Energi Anda sedang prima! Ini waktu terbaik untuk latihan kardio intensif, angkat beban, atau olahraga tim yang membutuhkan stamina tinggi.';
    } else if (cyclePhase.name === 'Fase Luteal') {
      exerciseRec.content = 'Alihkan olahraga Anda ke intensitas rendah hingga sedang, seperti pilates, jalan santai di alam terbuka, atau yoga vinyasa lambat.';
    }
    recommendations.push(exerciseRec);

    // Mindset & Sleep Recommendation
    let mindRec = {
      type: 'mind',
      title: 'Pikiran & Pola Tidur 😴',
      content: 'Istirahat yang cukup membantu tubuh menyeimbangkan fluktuasi hormon harian secara alami.'
    };

    const isHighStress = (avgStress && avgStress >= 3.5) || (latestLog && latestLog.stress_level >= 4);
    const isPoorSleep = (avgSleep && avgSleep <= 2.5) || (latestLog && latestLog.sleep_quality <= 2);

    if (isHighStress && isPoorSleep) {
      mindRec.content = 'Pola tidur buruk dan tingkat stres tinggi terdeteksi. Matikan perangkat elektronik 1 jam sebelum tidur, lakukan latihan pernapasan dalam (teknik 4-7-8) selama 5 menit, dan luangkan waktu untuk jurnal perasaan.';
    } else if (isHighStress) {
      mindRec.content = 'Tingkat stres Anda sedang meningkat. Cobalah bermeditasi selama 10 menit menggunakan teknik mindfulness, kurangi stimulasi layar berlebih, dan nikmati mandi air hangat untuk relaksasi tubuh.';
    } else if (isPoorSleep) {
      mindRec.content = 'Kualitas tidur Anda kurang optimal. Usahakan tidur dan bangun di jam yang konsisten. Konsumsi teh kamomil hangat sebelum tidur untuk membantu menenangkan sistem saraf.';
    } else {
      mindRec.content = 'Pikiran dan tidur Anda dalam kondisi seimbang. Pertahankan ritual malam yang santai dan luangkan waktu sejenak setiap hari untuk mengapresiasi diri sendiri.';
    }
    recommendations.push(mindRec);

    res.json({
      currentPhase: cyclePhase,
      symptomSummary: {
        topSymptoms,
        avgStress: avgStress || 'N/A',
        avgSleep: avgSleep || 'N/A',
        totalLogsAnalyzed: logRows.length
      },
      recommendations
    });
  } catch (err) {
    console.error('Get self-care insights error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
