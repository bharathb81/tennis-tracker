const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Setup PostgreSQL Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for hosting platforms like Render/Neon
});

// Create Table on Startup if it doesn't exist
const initDb = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tennis_bookings (
            id SERIAL PRIMARY KEY,
            booking_date DATE NOT NULL,
            time_slot VARCHAR(50) NOT NULL,
            court_number INT NOT NULL,
            players TEXT[] NOT NULL,
            UNIQUE(booking_date, time_slot, court_number)
        );
    `);
};
initDb().catch(err => console.error("DB Initialization Error:", err));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Get all bookings for a specific date range (supports day, week, month)
app.get('/api/bookings', async (req, res) => {
    const { start_date, end_date } = req.query;
    try {
        const result = await pool.query(
            'SELECT to_char(booking_date, \'YYYY-MM-DD\') as date, time_slot, court_number, players FROM tennis_bookings WHERE booking_date BETWEEN \$1 AND \$2',
            [start_date, end_date]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Save or Update a Doubles Match Lineup
app.post('/api/bookings', async (req, res) => {
    const { booking_date, time_slot, court_number, players } = req.body;
    if (!players || players.length !== 4) {
        return res.status(400).json({ error: "Exactly 4 players are required for doubles." });
    }
    try {
        await pool.query(`
            INSERT INTO tennis_bookings (booking_date, time_slot, court_number, players)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (booking_date, time_slot, court_number)
            DO UPDATE SET players = EXCLUDED.players;
        `, [booking_date, time_slot, court_number, players]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`Tennis Tracker Server running on port ${PORT}`));

