// vendor-c/vendor_c.js (Versi Final Tanpa Fungsi CREATE TABLE)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg'); 
const { authenticateToken, authorizeRole } = require('./auth.js'); // Pastikan path ini benar!

const app = express();
const PORT = process.env.PORT_VENDOR_C || 3003;
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("FATAL ERROR: DATABASE_URL tidak terdefinisi di .env!");
    process.exit(1);
}

// Inisialisasi Pool Koneksi Database Neon
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());

// ============================================
// === HELPER FUNCTIONS ===
// ============================================

const calculateFinalPrice = (base_price, tax) => {
    if (typeof base_price !== 'number' || typeof tax !== 'number') {
        throw new Error('base_price dan tax harus berupa angka');
    }
    return base_price + tax;
};

// Fungsi pemformatan data dari DB ke format Nested Object
const formatProductResponse = (dbProduct) => ({
    id: dbProduct.id,
    details: {
        name: dbProduct.name,
        category: dbProduct.category
    },
    pricing: {
        base_price: dbProduct.base_price,
        tax: dbProduct.tax,
        harga_final: dbProduct.harga_final
    },
    stock: dbProduct.stock,
    created_by: dbProduct.created_by,
    created_at: dbProduct.created_at
});

// ============================================
// === STATUS ENDPOINT ===
// ============================================
app.get('/status', async (req, res) => {
    let totalProducts = 0;
    try {
        const result = await pool.query('SELECT COUNT(*) FROM products');
        totalProducts = parseInt(result.rows[0].count);
    } catch (e) {
        // Jika tabel belum dibuat, ini akan mengembalikan error 500 saat diakses
        // namun untuk status check kita asumsikan 0 jika gagal terhitung
        console.error("Warning: Gagal menghitung produk, mungkin tabel belum dibuat.");
    }

    res.json({ 
        ok: true, 
        service: 'vendor-c-resto-api',
        vendor: 'Vendor C - Resto & Kuliner Banyuwangi (Neon Ready)',
        total_products: totalProducts
    });
});

// ============================================
// === AUTH ROUTES (CRUD ke NEON - Tabel Users diasumsikan sudah ada) ===
// ============================================

// Register User
app.post("/auth/register", async (req, res, next) => {
    const { username, password } = req.body; 
    
    if (!username || !password || password.length < 6) {
        return res
            .status(400)
            .json({ error: "Username dan password (min 6 char) harus diisi" });
    }
    
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const sql =
            "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role";
        const result = await pool.query(sql, [
            username.toLowerCase(),
            hashedPassword,
            "user", 
        ]);
        
        res.status(201).json({
            success: true,
            message: '✅ Registrasi berhasil!',
            user: result.rows[0]
        });
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "Username sudah digunakan" });
        }
        console.error(err);
        res.status(500).json({ error: "Registrasi gagal." });
    }
});

// Register Admin
app.post("/auth/register-admin", async (req, res, next) => {
    const { username, password } = req.body; 
    
    if (!username || !password || password.length < 6) {
        return res.status(400).json({ error: "Username dan password (min 6 char) harus diisi" });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const sql =
            "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role";
        const result = await pool.query(sql, [
            username.toLowerCase(),
            hashedPassword,
            "admin", 
        ]);
        
        res.status(201).json({
            success: true,
            message: '✅ Registrasi admin berhasil!',
            user: result.rows[0]
        });
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "Username sudah digunakan" });
        }
        console.error(err);
        res.status(500).json({ error: "Registrasi admin gagal." });
    }
});

// Login
app.post("/auth/login", async (req, res, next) => {
    const { username, password } = req.body;
    try {
        const sql = "SELECT * FROM users WHERE username = $1";
        const result = await pool.query(sql, [username.toLowerCase()]);
        const user = result.rows[0];
        
        if (!user) {
            return res.status(401).json({ error: "Username atau password salah!" });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ error: "Username atau password salah!" });
        }
        
        const payload = {
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
        
        res.json({ 
            success: true,
            message: "✅ Login berhasil", 
            token: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login gagal." });
    }
});


// ============================================
// === PRODUCTS ROUTES (CRUD ke NEON - Tabel Products diasumsikan sudah ada) ===
// ============================================

// GET All Products (Public)
app.get('/products', async (req, res) => {
    try {
        // Menggunakan nama tabel 'products' sesuai kode Anda
        const result = await pool.query('SELECT * FROM products ORDER BY id ASC'); 
        const formattedProducts = result.rows.map(formatProductResponse);

        res.json({
            success: true,
            message: formattedProducts.length > 0 
                ? '✅ Data produk berhasil diambil dari Neon' 
                : 'ℹ️ Belum ada produk. Tambahkan via POST /products',
            vendor: 'Vendor C - Resto & Kuliner (Neon)',
            total: formattedProducts.length,
            data: formattedProducts
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal mengambil data dari database Neon' });
    }
});

// GET Product by ID (Public)
app.get('/products/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }

        res.json({
            success: true,
            data: formatProductResponse(result.rows[0])
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal mengambil data dari database Neon' });
    }
});

// CREATE Product (Protected - User atau Admin)
app.post('/products', authenticateToken, async (req, res) => {
    const { name, category, base_price, tax, stock } = req.body;

    if (!name || !category || base_price === undefined || tax === undefined || stock === undefined) {
        return res.status(400).json({ error: 'Semua field wajib diisi: name, category, base_price, tax, stock' });
    }
    if (typeof base_price !== 'number' || typeof tax !== 'number' || typeof stock !== 'number') {
        return res.status(400).json({ error: 'base_price, tax, dan stock harus berupa angka (number)' });
    }

    try {
        const harga_final = calculateFinalPrice(base_price, tax);
        
        const query = `
            INSERT INTO products (name, category, base_price, tax, stock, harga_final, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const values = [name, category, base_price, tax, stock, harga_final, req.user.username];
        
        const result = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: '✅ Produk berhasil ditambahkan ke Neon!',
            data: formatProductResponse(result.rows[0])
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal membuat produk di database Neon: ' + err.message });
    }
});

// UPDATE Product (Protected - Hanya ADMIN)
app.put('/products/:id', [authenticateToken, authorizeRole('admin')], async (req, res) => {
    const productId = req.params.id;
    const { name, category, base_price, tax, stock } = req.body;
    
    try {
        const existingProductResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        
        if (existingProductResult.rows.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        const current = existingProductResult.rows[0];

        const newName = name || current.name;
        const newCategory = category || current.category;
        const newBasePrice = base_price !== undefined ? base_price : current.base_price;
        const newTax = tax !== undefined ? tax : current.tax;
        const newStock = stock !== undefined ? stock : current.stock;
        
        const newHargaFinal = calculateFinalPrice(newBasePrice, newTax);

        const query = `
            UPDATE products 
            SET name = $1, category = $2, base_price = $3, tax = $4, stock = $5, harga_final = $6, updated_by = $7, updated_at = NOW()
            WHERE id = $8
            RETURNING *
        `;
        const values = [newName, newCategory, newBasePrice, newTax, newStock, newHargaFinal, req.user.username, productId];
        
        const result = await pool.query(query, values);

        res.json({
            success: true,
            message: '✅ Produk berhasil diupdate di Neon!',
            data: formatProductResponse(result.rows[0])
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal mengupdate produk di database Neon: ' + err.message });
    }
});

// DELETE Product (Protected - Hanya ADMIN)
app.delete('/products/:id', [authenticateToken, authorizeRole('admin')], async (req, res) => {
    const productId = req.params.id;

    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [productId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }

        res.json({
            success: true,
            message: '✅ Produk berhasil dihapus dari Neon!',
            deleted_product: formatProductResponse(result.rows[0])
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal menghapus produk dari database Neon: ' + err.message });
    }
});

// ============================================
// === HELPER ENDPOINTS (Neon Based) ===
// ============================================

// Reset semua data (untuk testing)
app.post('/reset', [authenticateToken, authorizeRole('admin')], async (req, res) => {
    try {
        // Asumsi nama tabel adalah 'products' dan 'users'
        await pool.query('DELETE FROM products');
        await pool.query('ALTER SEQUENCE products_id_seq RESTART WITH 1');
        await pool.query('DELETE FROM users'); 
        await pool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
        
        res.json({
            success: true,
            message: '✅ Semua data produk & pengguna di Neon berhasil direset!'
        });
    } catch (err) {
        // Jika tabel belum ada, ini akan mengembalikan error 500. Ini adalah risiko menghapus create table.
        console.error("Kesalahan saat reset: Pastikan tabel 'products' dan 'users' sudah dibuat manual.");
        res.status(500).json({ error: 'Gagal mereset data di Neon. Pastikan tabel sudah dibuat.' });
    }
});

// Seed data (isi data dummy untuk testing)
app.post('/seed', [authenticateToken, authorizeRole('admin')], async (req, res) => {
    const seedData = [
        { name: "Nasi Tempong", category: "Food", base_price: 20000, tax: 2000, stock: 50 },
        { name: "Rawon Banyuwangi", category: "Food", base_price: 25000, tax: 2500, stock: 30 },
        { name: "Es Teh Manis", category: "Beverage", base_price: 5000, tax: 500, stock: 100 }
    ];

    try {
        await pool.query('DELETE FROM products');
        await pool.query('ALTER SEQUENCE products_id_seq RESTART WITH 1'); 

        const client = await pool.connect();
        await client.query('BEGIN'); 

        const insertedProducts = [];
        for (const item of seedData) {
            const harga_final = calculateFinalPrice(item.base_price, item.tax);
            const query = `
                INSERT INTO products (name, category, base_price, tax, stock, harga_final, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;
            const values = [
                item.name, item.category, item.base_price, item.tax, 
                item.stock, harga_final, req.user.username
            ];
            const result = await client.query(query, values);
            insertedProducts.push(formatProductResponse(result.rows[0]));
        }

        await client.query('COMMIT'); 
        client.release();

        res.json({
            success: true,
            message: `✅ ${insertedProducts.length} data dummy berhasil ditambahkan ke Neon!`,
            total: insertedProducts.length,
            data: insertedProducts
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal menambahkan data dummy ke Neon: ' + err.message });
    }
});

// ============================================
// === ERROR HANDLING & START SERVER ===
// ============================================
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err.stack);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

// === START SERVER FUNCTION ===
function startServer() {
    // Kita tidak perlu menunggu tabel dibuat di sini, langsung start server
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 Vendor C API (Neon Ready) berjalan di http://localhost:${PORT}`);
        console.log("---------------------------------------------------------------");
        console.log("❗ PERINGATAN: Pastikan Mahasiswa 2 telah membuat tabel 'products' dan 'users' secara manual di Neon!");
        console.log("---------------------------------------------------------------");
    });
}

startServer();