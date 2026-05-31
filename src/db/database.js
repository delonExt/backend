const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'menstrual_health_companion',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initializeDatabase() {
  // const dbName = process.env.DB_NAME || 'menstrual_health_companion';
  
  // // Create the database if it doesn't exist using a direct connection without a specified database
  // const tempConfig = {
  //   host: process.env.DB_HOST || 'localhost',
  //   user: process.env.DB_USER || 'root',
  //   password: process.env.DB_PASSWORD || '',
  //   database: process.env.DB_NAME || 'menstrual_health_companion',
  //   port: process.env.DB_PORT || 3306,
  // };
  
  // try {
  //   const tempConnection = await mysql.createConnection(tempConfig);
  //   await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  //   await tempConnection.end();
  //   console.log(`✅ Database "${dbName}" ensured/created`);
  // } catch (err) {
  //   console.error(`❌ Failed to ensure database "${dbName}":`, err);
  //   throw err;
  // }

  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        date_of_birth DATE,
        avg_cycle_length INT DEFAULT 28,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS menstrual_cycles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        cycle_length INT,
        period_length INT,
        flow_intensity VARCHAR(20) DEFAULT 'medium',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS daily_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date DATE NOT NULL,
        mood INT CHECK(mood BETWEEN 1 AND 5),
        symptoms TEXT,
        sleep_quality INT CHECK(sleep_quality BETWEEN 1 AND 5),
        stress_level INT CHECK(stress_level BETWEEN 1 AND 5),
        is_fasting TINYINT(1) DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS predictions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        predicted_next_date DATE NOT NULL,
        predicted_cycle_length INT,
        confidence FLOAT,
        model_version VARCHAR(50) DEFAULT '1.0',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        prediction_id INT,
        accuracy_rating INT CHECK(accuracy_rating BETWEEN 1 AND 5),
        actual_date DATE,
        comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE SET NULL
      )
    `);

    // Create indexes (use IF NOT EXISTS via try/catch for MySQL < 8.0.29)
    const indexes = [
      'CREATE INDEX idx_cycles_user ON menstrual_cycles(user_id)',
      'CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, date)',
      'CREATE INDEX idx_predictions_user ON predictions(user_id)'
    ];

    for (const idx of indexes) {
      try {
        await connection.query(idx);
      } catch (err) {
        // Index already exists — ignore
        if (err.code !== 'ER_DUP_KEYNAME') {
          console.warn('Index warning:', err.message);
        }
      }
    }

    console.log('✅ Database tables initialized');
  } finally {
    connection.release();
  }
}

module.exports = { pool, initializeDatabase };
