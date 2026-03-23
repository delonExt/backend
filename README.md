# ⚙️ Backend API — Menstrual Health Companion

REST API backend dibangun dengan **Express.js** dan database **MySQL**, menyediakan autentikasi JWT, CRUD operations, dan integrasi dengan ML Service untuk prediksi siklus menstruasi.

---

## 🛠️ Tech Stack

| Technology             | Purpose                        |
| ---------------------- | ------------------------------ |
| **Express.js 4.21**    | Web framework                  |
| **MySQL 8.0+**         | Relational database            |
| **mysql2 3.x**         | Async MySQL driver             |
| **JWT (jsonwebtoken)** | Token-based authentication     |
| **bcryptjs**           | Password hashing               |
| **Axios**              | HTTP client (ML Service calls) |
| **dotenv**             | Environment variables          |
| **CORS**               | Cross-origin resource sharing  |

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18.x
- MySQL ≥ 8.0

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your MySQL credentials

# 3. Ensure MySQL is running & database exists
mysql -u root -e "CREATE DATABASE IF NOT EXISTS menstrual_health_companion;"

# 4. Start server
npm start       # Production
npm run dev     # Development (auto-reload)
```

Server berjalan di `http://localhost:5000`

---

## 🔧 Environment Variables

| Variable         | Default                      | Description                                |
| ---------------- | ---------------------------- | ------------------------------------------ |
| `PORT`           | `5000`                       | Server port                                |
| `JWT_SECRET`     | -                            | **Required.** Secret key untuk JWT signing |
| `ML_SERVICE_URL` | `http://localhost:5001`      | URL ML prediction service                  |
| `DB_HOST`        | `localhost`                  | MySQL host                                 |
| `DB_USER`        | `root`                       | MySQL username                             |
| `DB_PASSWORD`    | _(empty)_                    | MySQL password                             |
| `DB_NAME`        | `menstrual_health_companion` | MySQL database name                        |

---

## 📁 Project Structure

```
backend/
├── package.json            # Dependencies & scripts
├── .env.example            # Environment template
├── .env                    # Environment variables (gitignored)
└── src/
    ├── server.js           # 🚀 Express app entry point
    ├── db/
    │   └── database.js     # 🗄️ MySQL pool + table initialization
    ├── middleware/
    │   └── auth.js         # 🔒 JWT verification middleware
    └── routes/
        ├── auth.js         # POST /api/auth/register, /login
        ├── profile.js      # GET, PUT /api/profile
        ├── cycles.js       # CRUD /api/cycles
        ├── dailyLogs.js    # CRUD /api/daily-logs
        ├── predictions.js  # GET /api/predictions
        └── feedback.js     # POST, GET /api/feedback
```

---

## 🗄️ Database Schema

Tabel dibuat secara otomatis saat server pertama kali dijalankan via `initializeDatabase()`.

### Tables

#### `users`

| Column           | Type         | Constraint                  |
| ---------------- | ------------ | --------------------------- |
| id               | INT          | PRIMARY KEY, AUTO_INCREMENT |
| name             | VARCHAR(255) | NOT NULL                    |
| email            | VARCHAR(255) | UNIQUE, NOT NULL            |
| password_hash    | VARCHAR(255) | NOT NULL                    |
| date_of_birth    | DATE         | nullable                    |
| avg_cycle_length | INT          | DEFAULT 28                  |
| created_at       | DATETIME     | DEFAULT CURRENT_TIMESTAMP   |

#### `menstrual_cycles`

| Column         | Type        | Constraint                        |
| -------------- | ----------- | --------------------------------- |
| id             | INT         | PRIMARY KEY, AUTO_INCREMENT       |
| user_id        | INT         | FK → users(id), ON DELETE CASCADE |
| start_date     | DATE        | NOT NULL                          |
| end_date       | DATE        | nullable                          |
| cycle_length   | INT         | nullable                          |
| period_length  | INT         | nullable                          |
| flow_intensity | VARCHAR(20) | DEFAULT 'medium'                  |
| notes          | TEXT        | nullable                          |
| created_at     | DATETIME    | DEFAULT CURRENT_TIMESTAMP         |

#### `daily_logs`

| Column        | Type       | Constraint                        |
| ------------- | ---------- | --------------------------------- |
| id            | INT        | PRIMARY KEY, AUTO_INCREMENT       |
| user_id       | INT        | FK → users(id), ON DELETE CASCADE |
| date          | DATE       | NOT NULL                          |
| mood          | INT        | CHECK 1-5                         |
| symptoms      | TEXT       | nullable (JSON)                   |
| sleep_quality | INT        | CHECK 1-5                         |
| stress_level  | INT        | CHECK 1-5                         |
| is_fasting    | TINYINT(1) | DEFAULT 0                         |
| notes         | TEXT       | nullable                          |
| created_at    | DATETIME   | DEFAULT CURRENT_TIMESTAMP         |

#### `predictions`

| Column                 | Type        | Constraint                        |
| ---------------------- | ----------- | --------------------------------- |
| id                     | INT         | PRIMARY KEY, AUTO_INCREMENT       |
| user_id                | INT         | FK → users(id), ON DELETE CASCADE |
| predicted_next_date    | DATE        | NOT NULL                          |
| predicted_cycle_length | INT         | nullable                          |
| confidence             | FLOAT       | nullable                          |
| model_version          | VARCHAR(50) | DEFAULT '1.0'                     |
| created_at             | DATETIME    | DEFAULT CURRENT_TIMESTAMP         |

#### `feedback`

| Column          | Type     | Constraint                               |
| --------------- | -------- | ---------------------------------------- |
| id              | INT      | PRIMARY KEY, AUTO_INCREMENT              |
| user_id         | INT      | FK → users(id), ON DELETE CASCADE        |
| prediction_id   | INT      | FK → predictions(id), ON DELETE SET NULL |
| accuracy_rating | INT      | CHECK 1-5                                |
| actual_date     | DATE     | nullable                                 |
| comments        | TEXT     | nullable                                 |
| created_at      | DATETIME | DEFAULT CURRENT_TIMESTAMP                |

### Indexes

- `idx_cycles_user` — menstrual_cycles(user_id)
- `idx_daily_logs_user_date` — daily_logs(user_id, date)
- `idx_predictions_user` — predictions(user_id)

---

## 🔌 API Reference

### Authentication

#### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securePassword123",
  "date_of_birth": "1995-06-15"
}
```

**Response** (201):

```json
{
  "message": "Registration successful",
  "token": "eyJhbGciOiJIUzI1...",
  "user": { "id": 1, "name": "Jane Doe", "email": "jane@example.com" }
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "securePassword123"
}
```

**Response** (200):

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1...",
  "user": { "id": 1, "name": "Jane Doe", "email": "jane@example.com" }
}
```

### Protected Endpoints

Semua endpoint di bawah ini memerlukan header:

```
Authorization: Bearer <token>
```

#### Cycles

- `POST /api/cycles` — Tambah siklus
- `GET /api/cycles` — Daftar semua siklus
- `GET /api/cycles/:id` — Detail siklus
- `PUT /api/cycles/:id` — Update siklus
- `DELETE /api/cycles/:id` — Hapus siklus

#### Daily Logs

- `POST /api/daily-logs` — Tambah/update log harian
- `GET /api/daily-logs?start_date=&end_date=` — Filter log by date range
- `GET /api/daily-logs/:date` — Log tanggal tertentu
- `DELETE /api/daily-logs/:id` — Hapus log

#### Predictions

- `GET /api/predictions` — Dapatkan prediksi baru (calls ML Service)
- `GET /api/predictions/history` — Riwayat 20 prediksi terakhir

#### Feedback

- `POST /api/feedback` — Submit feedback prediksi
- `GET /api/feedback` — Semua feedback

#### Profile

- `GET /api/profile` — Lihat profil
- `PUT /api/profile` — Update profil (name, date_of_birth, avg_cycle_length)

#### Health Check

- `GET /api/health` — Server status (no auth required)

---

## 🔒 Authentication Flow

```
1. User POST /api/auth/register atau /login
2. Server return JWT token (expires 7 days)
3. Client simpan token di localStorage
4. Setiap request ke protected endpoint, kirim header:
   Authorization: Bearer <token>
5. Middleware auth.js verify token → inject req.user = { id, email }
```

---

## ⚠️ Error Handling

Semua error response menggunakan format konsisten:

```json
{
  "error": "Error message description"
}
```

| Status Code | Description                          |
| ----------- | ------------------------------------ |
| 400         | Bad Request — missing/invalid fields |
| 401         | Unauthorized — no/invalid token      |
| 403         | Forbidden — expired token            |
| 404         | Not Found                            |
| 409         | Conflict — duplicate email           |
| 500         | Internal Server Error                |
