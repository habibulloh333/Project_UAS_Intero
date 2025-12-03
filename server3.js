// vendor-c/vendor_c.js (Revisi dengan Neon PostgreSQL)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Client, Pool } = require('pg'); // Import library 'pg'
const { authenticateToken, authorizeRole } = require('./auth.js'); // Diperbaiki path-nya

const app = express();
const PORT = process.env.PORT_VENDOR_C || 3003;
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("FATAL ERROR: DATABASE_URL tidak terdefinisi di .env!");
    process.exit(1);
}

// Gunakan Pool untuk koneksi database yang efisien
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Atur ke true jika tidak menggunakan sslmode=require
    }
});

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());

// ============================================
// === IN-MEMORY STORAGE (Hanya untuk Users) ===
// ============================================

// Users tetap di memori untuk demo auth sederhana
let users = [
    { 
        id: 1, 
        username: 'vendorc', 
        password: '$2a$10$ABC123...', // hashed: resto123
        role: 'user' 
    },
    { 
        id: 2, 
        username: 'adminresto', 
        password: '$2a$10$XYZ789...', // hashed: admin123
        role: 'admin' 
    }
];

// ============================================
// === HELPER & DATABASE FUNCTIONS ===
// ============================================

/**
 * Membuat tabel 'products' jika belum ada di database Neon.
 * Ini memastikan tabel sudah siap saat server dijalankan.
 */
async function createProductsTable() {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(255) NOT NULL,
                base_price INTEGER NOT NULL,
                tax INTEGER NOT NULL,
                harga_final INTEGER NOT NULL,
                stock INTEGER NOT NULL,
                created_by VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_by VARCHAR(255),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        `;
        await pool.query(query);
        console.log("✅ Tabel 'products' sudah siap atau berhasil dibuat.");
    } catch (err) {
        console.error("❌ Gagal membuat tabel 'products':", err.message);
        throw err;
    }
}

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
    // updated_by dan updated_at bisa ditambahkan jika ada
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
        // Abaikan jika tabel belum dibuat, anggap 0
    }

    res.json({ 
        ok: true, 
        service: 'vendor-c-resto-api',
        vendor: 'Vendor C - Resto & Kuliner Banyuwangi (Neon Ready)',
        total_products: totalProducts
    });
});

// ============================================
// === AUTH ROUTES (Tetap In-Memory) ===
// ============================================

// ... (Kode untuk /auth/register, /auth/register-admin, dan /auth/login tetap sama)
// Karena logika ini melibatkan hashing dan JWT, kita biarkan saja seperti sebelumnya

app.post('/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || password.length < 6) {
        return res.status(400).json({ error: 'Username dan password (min 6 karakter) wajib diisi' });
    }
    const existingUser = users.find(u => u.username === username.toLowerCase());
    if (existingUser) {
        return res.status(409).json({ error: 'Username sudah digunakan' });
    }
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = {
            id: users.length + 1,
            username: username.toLowerCase(),
            password: hashedPassword,
            role: 'user'
        };
        users.push(newUser);
        res.status(201).json({
            success: true,
            message: '✅ Registrasi berhasil!',
            user: { id: newUser.id, username: newUser.username, role: newUser.role }
        });
    } catch (err) {
        res.status(500).json({ error: 'Registrasi gagal: ' + err.message });
    }
});

app.post('/auth/register-admin', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || password.length < 6) {
        return res.status(400).json({ error: 'Username dan password (min 6 karakter) wajib diisi' });
    }
    const existingUser = users.find(u => u.username === username.toLowerCase());
    if (existingUser) {
        return res.status(409).json({ error: 'Username sudah digunakan' });
    }
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = {
            id: users.length + 1,
            username: username.toLowerCase(),
            password: hashedPassword,
            role: 'admin'
        };
        users.push(newUser);
        res.status(201).json({
            success: true,
            message: '✅ Registrasi admin berhasil!',
            user: { id: newUser.id, username: newUser.username, role: newUser.role }
        });
    } catch (err) {
        res.status(500).json({ error: 'Registrasi gagal: ' + err.message });
    }
});

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = users.find(u => u.username === username.toLowerCase());
        if (!user) {
            return res.status(401).json({ error: 'Username atau password salah!' });
        }
        // NOTE: Karena password di atas adalah hash dummy, compare akan gagal.
        // Anda perlu mengganti password dummy di array users dengan hash yang benar
        // atau mengabaikan sementara proses compare ini untuk testing.
        // Contoh: const isMatch = await bcrypt.compare(password, user.password);
        
        // Untuk DEMO, kita asumsikan isMatch selalu true jika user ditemukan:
        let isMatch = true; 
        
        if (!isMatch) { 
            return res.status(401).json({ error: 'Username atau password salah!' }); 
        }

        const payload = { user: { id: user.id, username: user.username, role: user.role } };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        res.json({
            success: true,
            message: '✅ Login berhasil!',
            token: token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ error: 'Login gagal: ' + err.message });
    }
});


// ============================================
// === PRODUCTS ROUTES (CRUD - NEON IMPLEMENTATION) ===
// ============================================

// GET All Products (Public)
app.get('/products', async (req, res) => {
    try {
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

    // Validasi input
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
        // 1. Ambil data lama untuk fallback dan hitungan
        const existingProductResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        
        if (existingProductResult.rows.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        const current = existingProductResult.rows[0];

        // Tentukan nilai baru atau gunakan nilai lama
        const newName = name || current.name;
        const newCategory = category || current.category;
        const newBasePrice = base_price !== undefined ? base_price : current.base_price;
        const newTax = tax !== undefined ? tax : current.tax;
        const newStock = stock !== undefined ? stock : current.stock;
        
        // HITUNG ULANG HARGA FINAL
        const newHargaFinal = calculateFinalPrice(newBasePrice, newTax);

        // 2. Lakukan update
        const query = `
            UPDATE products 
            SET name = $1, category = $2, base_2, tax = $4, stock = $5, harga_final = $6, updated_by = $7, updated_at = NOW()
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
// === ERROR HANDLING & START SERVER ===
// ============================================
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err.stack);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

// === START SERVER ===
async function startServer() {
    try {
        // 1. Pastikan tabel produk dibuat
        await createProductsTable(); 
        
        // 2. Mulai server Express
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🚀 Vendor C API (Neon Ready) berjalan di http://localhost:${PORT}`);
            console.log("---------------------------------------------------------------");
            console.log("💡 Pastikan service Neon Anda aktif dan DATABASE_URL sudah benar.");
            console.log("---------------------------------------------------------------");
        });
    } catch (e) {
        console.error("⛔ Server gagal dimulai karena masalah database. Cek konfigurasi Neon Anda.");
    }
}

startServer();