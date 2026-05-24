require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function seed() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'menstrual_health_companion',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    // Ensure the users table exists
    await pool.execute(`
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

    const dummyUsers = [
      {
        name: 'Demo User',
        email: 'demo@example.com',
        password: 'demo1234',
        date_of_birth: '1998-05-15',
      },
      {
        name: 'Test User',
        email: 'test@test.com',
        password: 'test1234',
        date_of_birth: '2000-01-20',
      },
    ];

    for (const u of dummyUsers) {
      // Check if already exists
      const [existing] = await pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [u.email]
      );

      if (existing.length > 0) {
        console.log(`⚠️  User ${u.email} already exists — skipping.`);
        continue;
      }

      const password_hash = bcrypt.hashSync(u.password, 10);
      await pool.execute(
        'INSERT INTO users (name, email, password_hash, date_of_birth) VALUES (?, ?, ?, ?)',
        [u.name, u.email, password_hash, u.date_of_birth]
      );
      console.log(`✅ Created user: ${u.email} / password: ${u.password}`);
    }

    console.log('\n🎉 Seed complete! You can now login with:');
    console.log('   📧 Email   : demo@example.com');
    console.log('   🔑 Password: demo1234');
    console.log('   — or —');
    console.log('   📧 Email   : test@test.com');
    console.log('   🔑 Password: test1234');
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
