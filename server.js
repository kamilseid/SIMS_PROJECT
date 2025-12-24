const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static frontend files

// Database Setup
const db = new sqlite3.Database('./inventory.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Items Table
        db.run(`CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            quantity INTEGER DEFAULT 0,
            unit TEXT,
            min_threshold INTEGER DEFAULT 5,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Usage History Table (for trends)
        db.run(`CREATE TABLE IF NOT EXISTS usage_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            quantity_change INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(item_id) REFERENCES items(id)
        )`);

        // Activity Logs Table (Audit Trail)
        db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

// Helper to log activity
function logActivity(action, details) {
    db.run(`INSERT INTO activity_logs (action, details) VALUES (?, ?)`, [action, details]);
}

// Routes

// Login Endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Hardcoded credentials for simplicity as requested
    if (username === 'admin' && password === 'admin123') {
        res.json({ success: true, token: 'mock-token-12345' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Get all items
app.get('/api/items', (req, res) => {
    const { search, category } = req.query;
    let query = "SELECT * FROM items WHERE 1=1";
    let params = [];

    if (search) {
        query += " AND name LIKE ?";
        params.push(`%${search}%`);
    }
    if (category) {
        query += " AND category = ?";
        params.push(category);
    }

    query += " ORDER BY name ASC";

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Add new item
app.post('/api/items', (req, res) => {
    const { name, category, quantity, unit, min_threshold } = req.body;
    const sql = `INSERT INTO items (name, category, quantity, unit, min_threshold) VALUES (?, ?, ?, ?, ?)`;
    const params = [name, category, quantity, unit, min_threshold];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        // Log initial stock and activity
        db.run(`INSERT INTO usage_logs (item_id, quantity_change) VALUES (?, ?)`, [this.lastID, quantity]);
        logActivity('ADD_ITEM', `Added new item: ${name} (${quantity} ${unit})`);

        res.json({
            id: this.lastID,
            name, category, quantity, unit, min_threshold
        });
    });
});

// Update item (edit details or quantity)
app.put('/api/items/:id', (req, res) => {
    const { name, category, quantity, unit, min_threshold } = req.body;
    const { id } = req.params;

    // First get old quantity to log usage difference if needed
    db.get("SELECT quantity FROM items WHERE id = ?", [id], (err, row) => {
        if (err || !row) {
            res.status(404).json({ error: "Item not found" });
            return;
        }

        const oldQty = row.quantity;
        const diff = quantity - oldQty;

        const sql = `UPDATE items SET name = ?, category = ?, quantity = ?, unit = ?, min_threshold = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`;
        const params = [name, category, quantity, unit, min_threshold, id];

        db.run(sql, params, function (err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }

            // Log usage if quantity changed
            if (diff !== 0) {
                db.run(`INSERT INTO usage_logs (item_id, quantity_change) VALUES (?, ?)`, [id, diff]);
                logActivity('UPDATE_STOCK', `Updated stock for ${name}: ${oldQty} -> ${quantity}`);
            } else {
                logActivity('UPDATE_DETAILS', `Updated details for ${name}`);
            }

            res.json({ message: "Item updated", changes: this.changes });
        });
    });
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
    const { id } = req.params;
    // Get name before deleting for log
    db.get("SELECT name FROM items WHERE id = ?", [id], (err, row) => {
        const itemName = row ? row.name : 'Unknown Item';
        db.run(`DELETE FROM items WHERE id = ?`, [id], function (err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            logActivity('DELETE_ITEM', `Deleted item: ${itemName}`);
            res.json({ message: "Item deleted", changes: this.changes });
        });
    });
});

// Get Activity Logs
app.get('/api/logs', (req, res) => {
    db.all("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get Predictions
app.get('/api/predictions', (req, res) => {
    // Complex Query: Calculate average daily usage from usage_logs (negative changes only)
    const sql = `
        SELECT 
            i.id, i.name, i.quantity, i.unit,
            ABS(SUM(CASE WHEN u.quantity_change < 0 THEN u.quantity_change ELSE 0 END)) as total_usage_last_7_days,
            COUNT(DISTINCT DATE(u.timestamp)) as usage_days
        FROM items i
        LEFT JOIN usage_logs u ON i.id = u.item_id 
        WHERE u.timestamp >= date('now', '-7 days')
        GROUP BY i.id
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const predictions = rows.map(row => {
            // Avoid division by zero
            // If no data, assume mock small usage for demo purpose so it's not empty
            const avgDailyUsage = row.total_usage_last_7_days > 0 ? (row.total_usage_last_7_days / 7) : 0;

            let daysLeft;
            if (avgDailyUsage > 0) {
                daysLeft = Math.floor(row.quantity / avgDailyUsage);
            } else {
                daysLeft = 999; // "Plenty"
            }

            return {
                name: row.name,
                currentStock: row.quantity,
                unit: row.unit,
                avgDailyUsage: avgDailyUsage.toFixed(1),
                daysLeft: daysLeft
            };
        });

        res.json(predictions);
    });
});

// Dashboard Stats
app.get('/api/dashboard', (req, res) => {
    const stats = {};

    // Total Items
    db.get("SELECT COUNT(*) as count FROM items", [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.totalItems = row.count;

        // Low Stock Items
        db.all("SELECT * FROM items WHERE quantity <= min_threshold", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.lowStockItems = rows;
            stats.lowStockCount = rows.length;

            res.json(stats);
        });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
