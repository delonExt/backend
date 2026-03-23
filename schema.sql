-- Menstrual Health Companion - MySQL Database Schema
-- Run this script to manually initialize the database

CREATE DATABASE IF NOT EXISTS menstrual_health_companion;
USE menstrual_health_companion;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  date_of_birth DATE,
  avg_cycle_length INT DEFAULT 28,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
);

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
);

CREATE TABLE IF NOT EXISTS predictions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  predicted_next_date DATE NOT NULL,
  predicted_cycle_length INT,
  confidence FLOAT,
  model_version VARCHAR(50) DEFAULT '1.0',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
);

-- Note: MySQL does not support "IF NOT EXISTS" in CREATE INDEX for < 8.0.29 in standard syntax
-- If using older versions, these might fail gracefully if index already exists
CREATE INDEX idx_cycles_user ON menstrual_cycles(user_id);
CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX idx_predictions_user ON predictions(user_id);

SELECT 'Database successfully initialized!' AS status;
