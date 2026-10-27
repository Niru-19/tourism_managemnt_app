const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// MySQL Database Connection (Added .promise() to support async/await)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Niranjana19@5',
    database: 'tourism_db'
}).promise();

// Test database connection on startup
(async () => {
    try {
        await db.connect();
        console.log('Connected to MySQL database.');
    } catch (error) {
        console.error('MySQL connection failed:', error.message);
    }
})();

// Middleware
app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 1. USER AUTHENTICATION ROUTES
// ==========================================

// User Registration Route
app.post('/register', async (req, res) => {
    try {
        const { username, email, password, full_name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)`;
        
        await db.query(sql, [username, email, hashedPassword, full_name]);
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error('FULL DATABASE ERROR:', error);
        res.status(500).json({ error: 'Server error during registration: ' + error.message });
    }
});

// User Login Route
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const sql = `SELECT * FROM users WHERE email = ?`;
        const [results] = await db.query(sql, [email]);

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        res.json({ 
            message: 'Login successful!', 
            user: { id: user.user_id, username: user.username, email: user.email, full_name: user.full_name } 
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Database error.' });
    }
});

// Update User Password
app.put('/api/user/change-password', async (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;

        const [results] = await db.query('SELECT password FROM users WHERE user_id = ?', [userId]);
        if (results.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = results[0];
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedNewPassword, userId]);
        
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/user-bookings', async (req, res) => {
    try {
        const userId = req.query.userId;
        const [bookings] = await db.query(`
            SELECT b.booking_id, t.Destination, t.\`Duration (days)\` AS Duration, b.total_amount, b.status, b.booking_date 
            FROM bookings b 
            JOIN travel_details t ON b.trip_id = t.\`Trip ID\` 
            WHERE b.user_id = ?
        `, [userId]);
        
        res.json(bookings);
    } catch (err) {
        console.error('Error fetching user bookings:', err);
        res.status(500).json({ error: err.message });
    }
});
/// Get booked packages history for a user
app.get('/api/user-bookings', async (req, res) => {
    try {
        const userId = req.query.userId;
        const [bookings] = await db.query(`
            SELECT b.booking_id, t.Destination, t.\`Duration (days)\` AS Duration, b.total_amount, b.status 
            FROM bookings b 
            JOIN travel_details t ON b.trip_id = t.\`Trip ID\` 
            WHERE b.user_id = ?
        `, [userId]);
        
        res.json(bookings);
    } catch (err) {
        console.error('Error fetching user bookings:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. PACKAGES ROUTE (WITH CATEGORY FILTERING)
// ==========================================

app.get('/packages-data', async (req, res) => {
    try {
        const category = req.query.category;
        console.log('🔍 Server received category filter:', category);
        
        if (category) {
            const sql = 'SELECT * FROM travel_details WHERE TRIM(category) = TRIM(?)';
            const [results] = await db.query(sql, [category]);
            console.log(`📦 Found ${results.length} packages for category: ${category}`);
            res.json(results);
        } else {
            const sql = 'SELECT * FROM travel_details';
            const [results] = await db.query(sql);
            res.json(results);
        }
    } catch (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. ADMIN ROUTES
// ==========================================

const handleAdminLogin = (req, res) => {
    const { username, password } = req.body;
    
    if (username === 'admin' && password === 'admin@123') {
        res.json({ message: 'Admin login successful', admin: { username: 'admin', role: 'Super Admin' } });
    } else {
        res.status(401).json({ error: 'Invalid admin credentials.' });
    }
};

app.post('/admin-login', handleAdminLogin);
app.post('/admin_login', handleAdminLogin);

// Admin: Packages CRUD
app.get('/api/admin/packages', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM travel_details');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/packages', async (req, res) => {
    try {
        const { Destination, duration, accCost, transCost, category } = req.body;
        const sql = 'INSERT INTO travel_details (Destination, `Duration (days)`, `Accommodation cost`, `Transportation cost`, category) VALUES (?, ?, ?, ?, ?)';
        await db.query(sql, [Destination, duration, accCost, transCost, category || null]);
        res.status(201).json({ message: 'Package added successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/packages/:id', async (req, res) => {
    try {
        const tripId = req.params.id;
        const { Destination, duration, accCost, transCost, category } = req.body;
        const sql = 'UPDATE travel_details SET Destination = ?, `Duration (days)` = ?, `Accommodation cost` = ?, `Transportation cost` = ?, category = ? WHERE `Trip ID` = ?';
        await db.query(sql, [Destination, duration, accCost, transCost, category, tripId]);
        res.json({ message: 'Package updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/packages/:id', async (req, res) => {
    try {
        const tripId = req.params.id;
        await db.query('DELETE FROM travel_details WHERE `Trip ID` = ?', [tripId]);
        res.json({ message: 'Package deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Users CRUD
app.get('/api/admin/users', async (req, res) => {
    try {
        const [results] = await db.query('SELECT user_id, username, email, full_name, created_at FROM users');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/users', async (req, res) => {
    try {
        const { username, email, password, full_name } = req.body;
        const hashedPassword = await bcrypt.hash(password || 'default123', 10);
        const sql = 'INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)';
        await db.query(sql, [username, email, hashedPassword, full_name]);
        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { username, email, full_name } = req.body;
        const sql = 'UPDATE users SET username = ?, email = ?, full_name = ? WHERE user_id = ?';
        await db.query(sql, [username, email, full_name, userId]);
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('DELETE FROM bookings WHERE user_id = ?', [userId]);
        await db.query('DELETE FROM users WHERE user_id = ?', [userId]);
        await db.query('SET FOREIGN_KEY_CHECKS = 1');
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        await db.query('SET FOREIGN_KEY_CHECKS = 1');
        res.status(500).json({ error: err.message });
    }
});

// Secure Package Booking Route
app.post('/api/book-package', async (req, res) => {
    try {
        console.log('--- BOOKING REQUEST RECEIVED ---');
        const { userId, tripId, cardNumber, expiry, totalAmount } = req.body;

        if (!cardNumber) {
            return res.status(400).json({ error: 'Card number is missing' });
        }

        // Clean query with NO reference to start_date or end_date
        const query = `INSERT INTO bookings (user_id, trip_id, total_amount, status) VALUES (?, ?, ?, 'Confirmed')`;
        const [result] = await db.query(query, [
            userId || 1, 
            tripId || 1, 
            totalAmount || 1700
        ]);

        console.log('✅ Successfully inserted booking ID:', result.insertId);
        return res.status(200).json({ success: true, bookingId: result.insertId });

    } catch (err) {
        console.error('❌ CRITICAL DB INSERT ERROR:', err.message);
        return res.status(500).json({ error: 'Database error: ' + err.message });
    }
});
// ==========================================
// 4. START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log(`Website running at http://localhost:${PORT}`);
});