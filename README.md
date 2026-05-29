<div align="center">

# ⚙️ YeoCycles — Backend API

### Menstrual Health Companion · RESTful API Server

[![Express.js](https://img.shields.io/badge/Express.js-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**REST API backend** menyediakan autentikasi JWT, CRUD operations untuk data siklus & log harian, serta integrasi dengan ML Service untuk prediksi berbasis deep learning.

[Fitur](#-fitur-utama) · [Arsitektur](#️-arsitektur) · [API Reference](#-api-reference) · [Database](#️-database-schema) · [Quick Start](#-quick-start)

</div>

---

## 🏗️ Arsitektur

### Full-Stack Overview

<p align="center">
  <img src="docs/images/system_architecture.png" alt="System Architecture" width="700" />
</p>

### Backend API Architecture

<p align="center">
  <img src="docs/images/api_architecture.png" alt="API Architecture" width="600" />
</p>

### Request Lifecycle — Detail

Setiap HTTP request melewati pipeline middleware berikut sebelum mencapai route handler:

```mermaid
graph LR
    Client["🌐 Client<br/>(React SPA)"] -->|"HTTP Request"| CORS["CORS<br/>Middleware"]
    CORS --> JSON["JSON<br/>Body Parser"]
    JSON --> Auth{"Auth<br/>Required?"}
    
    Auth -->|"No (Public)"| PublicRoutes["🔓 Public Routes<br/>POST /auth/register<br/>POST /auth/login<br/>GET /health"]
    Auth -->|"Yes (Protected)"| JWTVerify["🔒 JWT Verify<br/>auth.js middleware"]
    
    JWTVerify -->|"Valid Token"| ProtectedRoutes["🔐 Protected Routes<br/>Cycles, Logs,<br/>Predictions, etc."]
    JWTVerify -->|"Invalid/Expired"| Reject["❌ 401/403<br/>Unauthorized"]
    
    ProtectedRoutes --> DB[("🗄️ MySQL<br/>Database")]
    ProtectedRoutes -->|"/predictions"| ML["🧠 ML Service<br/>Flask API"]
    PublicRoutes --> DB

    style Client fill:#ec4899,stroke:#fff,color:#fff
    style JWTVerify fill:#a855f7,stroke:#fff,color:#fff
    style DB fill:#3b82f6,stroke:#fff,color:#fff
    style ML fill:#10b981,stroke:#fff,color:#fff
    style Reject fill:#ef4444,stroke:#fff,color:#fff
```

### Server Startup Sequence

```mermaid
sequenceDiagram
    participant S as 🚀 server.js
    participant DB as 🗄️ database.js
    participant MySQL as 💾 MySQL Server
    participant Routes as 🔌 Route Modules

    S->>S: Load environment (.env)
    S->>S: Initialize Express app
    S->>S: Apply CORS middleware
    S->>S: Apply JSON body parser
    
    S->>Routes: Mount route modules
    Note over S,Routes: /api/auth → auth.js<br/>/api/cycles → cycles.js<br/>/api/daily-logs → dailyLogs.js<br/>/api/predictions → predictions.js<br/>/api/feedback → feedback.js<br/>/api/profile → profile.js
    
    S->>DB: initializeDatabase()
    DB->>MySQL: CREATE TABLE IF NOT EXISTS users
    DB->>MySQL: CREATE TABLE IF NOT EXISTS menstrual_cycles
    DB->>MySQL: CREATE TABLE IF NOT EXISTS daily_logs
    DB->>MySQL: CREATE TABLE IF NOT EXISTS predictions
    DB->>MySQL: CREATE TABLE IF NOT EXISTS feedback
    DB->>MySQL: CREATE INDEX (3 indexes)
    MySQL-->>DB: ✅ Tables ready
    DB-->>S: ✅ Database initialized
    
    S->>S: app.listen(PORT)
    Note over S: 🟢 Server running on :5000
```

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| 🔐 **JWT Authentication** | Register & login dengan token-based auth (expires 7 hari) |
| 🩸 **Cycle CRUD** | Create, Read, Update, Delete data siklus menstruasi |
| 📋 **Daily Logs** | Pencatatan mood, symptoms, tidur, stres, puasa harian |
| 🧠 **ML Integration** | Proxy ke Flask ML Service untuk prediksi siklus (LSTM) |
| 📊 **Predictions History** | Menyimpan & mengambil riwayat prediksi |
| 💬 **Feedback System** | User feedback untuk akurasi prediksi model |
| 👤 **Profile Management** | CRUD profil pengguna |
| 🛡️ **Security** | bcrypt hashing, parameterized queries, CORS |
| 🗄️ **Auto-Migration** | Tabel database dibuat otomatis saat pertama start |
| ❤️ **Health Check** | Endpoint `/api/health` untuk monitoring |

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Express.js** | 4.21 | Web framework (REST API) |
| **MySQL** | 8.0+ | Relational database |
| **mysql2** | 3.x | Async MySQL driver (Promise-based) |
| **jsonwebtoken** | 9.x | Token-based authentication |
| **bcryptjs** | 2.x | Password hashing (12 salt rounds) |
| **Axios** | 1.x | HTTP client (ML Service integration) |
| **dotenv** | 16.x | Environment variable management |
| **cors** | 2.x | Cross-Origin Resource Sharing |
| **nodemon** | 3.x | Dev auto-reload |

---

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone https://github.com/Coding-Camp-Capstone-Project-2026/backend.git
cd backend && npm install

# 2. Setup environment
cp .env.example .env    # Edit .env dengan credentials MySQL Anda

# 3. Create database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS menstrual_health_companion;"

# 4. Start server
npm run dev     # Development (nodemon auto-reload)
npm start       # Production
```

> **💡**: Tabel database dibuat otomatis saat server pertama kali start.

---

## 🔧 Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `5000` | ❌ | Port server |
| `JWT_SECRET` | — | ✅ | Secret key untuk JWT (min 32 char) |
| `ML_SERVICE_URL` | `http://localhost:5001` | ❌ | URL ML Service |
| `DB_HOST` | `localhost` | ❌ | MySQL host |
| `DB_USER` | `root` | ❌ | MySQL username |
| `DB_PASSWORD` | _(empty)_ | ❌ | MySQL password |
| `DB_NAME` | `menstrual_health_companion` | ❌ | Database name |

> **⚠️ Security**: File `.env` sudah di `.gitignore`. **JANGAN** commit credentials!

---

## 📁 Project Structure

```
backend/
├── package.json            # Dependencies & scripts
├── .env.example            # Environment template (safe)
├── .env                    # Credentials (GITIGNORED)
├── .gitignore              # Ignore rules
├── schema.sql              # Database schema (reference)
├── docs/
│   └── images/             # Architecture visuals
└── src/
    ├── server.js           # 🚀 Express entry point
    ├── db/
    │   └── database.js     # 🗄️ MySQL pool + auto-migration
    ├── middleware/
    │   └── auth.js         # 🔒 JWT verification
    └── routes/
        ├── auth.js         # 🔐 Register & login
        ├── profile.js      # 👤 Profile CRUD
        ├── cycles.js       # 🩸 Menstrual cycles CRUD
        ├── dailyLogs.js    # 📋 Daily logs CRUD
        ├── predictions.js  # 🧠 ML predictions proxy
        └── feedback.js     # 💬 Prediction feedback
```

---

## 🗄️ Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ menstrual_cycles : "has many"
    users ||--o{ daily_logs : "has many"
    users ||--o{ predictions : "has many"
    users ||--o{ feedback : "has many"
    predictions ||--o{ feedback : "evaluated by"

    users {
        int id PK
        varchar name
        varchar email UK
        varchar password_hash
        date date_of_birth
        int avg_cycle_length
        datetime created_at
    }

    menstrual_cycles {
        int id PK
        int user_id FK
        date start_date
        date end_date
        int cycle_length
        int period_length
        varchar flow_intensity
        text notes
        datetime created_at
    }

    daily_logs {
        int id PK
        int user_id FK
        date date
        int mood "1-5"
        text symptoms "JSON"
        int sleep_quality "1-5"
        int stress_level "1-5"
        tinyint is_fasting
        text notes
        datetime created_at
    }

    predictions {
        int id PK
        int user_id FK
        date predicted_next_date
        int predicted_cycle_length
        float confidence "0-1"
        varchar model_version
        datetime created_at
    }

    feedback {
        int id PK
        int user_id FK
        int prediction_id FK
        int accuracy_rating "1-5"
        date actual_date
        text comments
        datetime created_at
    }
```

### Indexes

```sql
CREATE INDEX idx_cycles_user ON menstrual_cycles(user_id);
CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX idx_predictions_user ON predictions(user_id);
```

---

## 🔌 API Reference

### Authentication (Public)

#### `POST /api/auth/register`
```json
// Request
{ "name": "Jane", "email": "jane@example.com", "password": "secret123", "date_of_birth": "1995-06-15" }

// Response (201)
{ "message": "Registration successful", "token": "eyJ...", "user": { "id": 1, "name": "Jane", "email": "jane@example.com" } }
```

#### `POST /api/auth/login`
```json
// Request
{ "email": "jane@example.com", "password": "secret123" }

// Response (200)
{ "message": "Login successful", "token": "eyJ...", "user": { "id": 1, "name": "Jane", "email": "jane@example.com" } }
```

### Protected Endpoints

> **Header wajib:** `Authorization: Bearer <token>`

#### 🩸 Cycles

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cycles` | Tambah siklus |
| `GET` | `/api/cycles` | List semua siklus |
| `GET` | `/api/cycles/:id` | Detail siklus |
| `PUT` | `/api/cycles/:id` | Update siklus |
| `DELETE` | `/api/cycles/:id` | Hapus siklus |

#### 📋 Daily Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/daily-logs` | Tambah/update log |
| `GET` | `/api/daily-logs?start_date=&end_date=` | Filter range |
| `GET` | `/api/daily-logs/:date` | Log per tanggal |
| `DELETE` | `/api/daily-logs/:id` | Hapus log |

#### 🧠 Predictions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/predictions` | Generate prediksi → ML |
| `GET` | `/api/predictions/history` | 20 prediksi terakhir |

### Prediction Flow (ML Integration)

```mermaid
sequenceDiagram
    participant C as 🌐 Client
    participant B as ⚙️ Backend
    participant DB as 🗄️ MySQL
    participant ML as 🧠 ML Service

    C->>B: GET /api/predictions
    B->>DB: SELECT last 3 cycles WHERE user_id = ?
    DB-->>B: cycles[]
    
    alt ML Service Available
        B->>ML: POST /predict { cycles, sleep, stress, fasting }
        ML->>ML: LSTM inference + confidence calc
        ML-->>B: { predicted_cycle_length, confidence, model_version }
        B->>DB: INSERT INTO predictions (...)
        B-->>C: { prediction, confidence: 0.85 }
    else ML Service Unreachable
        B->>B: Calculate simple average
        B->>DB: INSERT INTO predictions (model_version: 'fallback')
        B-->>C: { prediction, confidence: 0.5, message: "fallback" }
    end
```

#### 💬 Feedback · 👤 Profile · ❤️ Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/feedback` | Submit feedback |
| `GET` | `/api/feedback` | List feedback |
| `GET` | `/api/profile` | Lihat profil |
| `PUT` | `/api/profile` | Update profil |
| `GET` | `/api/health` | Server status (no auth) |

---

## 🔒 Authentication Flow

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant FE as 🖥️ React Frontend
    participant BE as ⚙️ Express Backend
    participant DB as 🗄️ MySQL

    rect rgb(30, 30, 60)
        Note over U,DB: Registration Flow
        U->>FE: Fill register form
        FE->>BE: POST /api/auth/register
        BE->>BE: Validate input
        BE->>BE: bcrypt.hash(password, 12)
        BE->>DB: INSERT INTO users
        DB-->>BE: user.id
        BE->>BE: jwt.sign({ id, email }, secret, { expiresIn: '7d' })
        BE-->>FE: { token, user }
        FE->>FE: localStorage.setItem('token')
    end

    rect rgb(30, 40, 60)
        Note over U,DB: Authenticated Request Flow
        U->>FE: Navigate to Dashboard
        FE->>FE: Attach "Authorization: Bearer <token>"
        FE->>BE: GET /api/cycles
        BE->>BE: auth.js: jwt.verify(token, secret)
        BE->>BE: req.user = { id, email }
        BE->>DB: SELECT * FROM menstrual_cycles WHERE user_id = ?
        DB-->>BE: cycles[]
        BE-->>FE: { cycles: [...] }
    end

    rect rgb(60, 30, 30)
        Note over U,DB: Token Expiry Flow
        FE->>BE: GET /api/cycles (expired token)
        BE->>BE: jwt.verify → TokenExpiredError
        BE-->>FE: 401 Unauthorized
        FE->>FE: AuthContext.logout()
        FE->>FE: localStorage.removeItem('token')
        FE-->>U: Redirect to /login
    end
```

### Security Measures

| Measure | Implementation |
|---------|---------------|
| **Password Hashing** | bcryptjs, 12 salt rounds |
| **JWT Expiry** | 7 days (`expiresIn: '7d'`) |
| **SQL Injection** | Parameterized queries (mysql2) |
| **CORS** | Configurable allowed origins |
| **Error Handling** | Consistent JSON, no stack traces |
| **Environment Vars** | `.env` gitignored |

---

## ⚠️ Error Handling

```json
{ "error": "Human-readable error message" }
```

| Status | Description | Example |
|--------|-------------|---------|
| `400` | Bad Request | Missing fields |
| `401` | Unauthorized | Invalid token |
| `403` | Forbidden | Expired token |
| `404` | Not Found | ID not found |
| `409` | Conflict | Duplicate email |
| `500` | Server Error | DB connection fail |

---

## 🔗 Related Repositories

| Repository | Description | Link |
|------------|-------------|------|
| **Frontend** | React SPA + Premium UI | [frontend](https://github.com/Coding-Camp-Capstone-Project-2026/frontend) |
| **Backend** | Express REST API (this repo) | [backend](https://github.com/Coding-Camp-Capstone-Project-2026/backend) |
| **Machine Learning** | Flask + LSTM Service | [machinelearning](https://github.com/Coding-Camp-Capstone-Project-2026/machinelearning) |

---

## 👥 Tim Pengembang

Dibuat oleh **Ridho dan teman-teman** — Capstone Project Coding Camp 2026

**Powered by [kamidukung.biz.id](https://kamidukung.biz.id/)**

