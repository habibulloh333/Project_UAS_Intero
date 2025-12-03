// vendor-c/vendor_c.js (Versi Sederhana dengan harga_final)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticateToken, authorizeRole } = require('../middleware/auth.js'); // Asumsi middleware ini ada

const app = express();
const PORT = process.env.PORT_VENDOR_C || 3003;
const JWT_SECRET = process.env.JWT_SECRET;

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());

// ============================================
// === IN-MEMORY STORAGE (Data Sementara) ===
// ============================================

// Storage untuk products
let products = [];

// Storage untuk users
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

// ID counter untuk auto-increment
let productIdCounter = 501;

// ============================================
// === HELPER FUNCTION ===
// ============================================

/**
 * Menghitung harga_final dari base_price dan tax
 * @param {number} base_price Harga dasar
 * @param {number} tax Pajak
 * @returns {number} Harga akhir (base_price + tax)
 */
const calculateFinalPrice = (base_price, tax) => {
    // Pastikan input adalah angka
    if (typeof base_price !== 'number' || typeof tax !== 'number') {
        throw new Error('base_price dan tax harus berupa angka');
    }
    return base_price + tax;
};


// ============================================
// === STATUS ENDPOINT ===
// ============================================
app.get('/status', (req, res) => {
    res.json({ 
        ok: true, 
        service: 'vendor-c-resto-api',
        vendor: 'Vendor C - Resto & Kuliner Banyuwangi',
        total_products: products.length
    });
});

// ============================================
// === AUTH ROUTES (Disimpan SAMA) ===
// ============================================

// [Kode POST /auth/register, /auth/register-admin, /auth/login tetap sama seperti di atas]

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
        const isMatch = await bcrypt.compare(password, user.password);
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
// === PRODUCTS ROUTES (CRUD) ===
// ============================================

// GET All Products (Public)
app.get('/products', (req, res) => {
    // Di sini, kita akan mengembalikan data produk apa adanya, karena harga_final sudah dihitung saat POST/Seed.
    res.json({
        success: true,
        message: products.length > 0 ? '✅ Data produk berhasil diambil' : 'ℹ️ Belum ada produk. Tambahkan via POST /products',
        vendor: 'Vendor C - Resto & Kuliner',
        total: products.length,
        data: products
    });
});

// GET Product by ID (Public)
app.get('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);

    if (!product) {
        return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }
    res.json({ success: true, data: product });
});

// CREATE Product (Protected - User atau Admin)
app.post('/products', authenticateToken, (req, res) => {
    const { name, category, base_price, tax, stock } = req.body;

    // Validasi input
    if (!name || !category || base_price === undefined || tax === undefined || stock === undefined) {
        return res.status(400).json({ error: 'Semua field wajib diisi: name, category, base_price, tax, stock' });
    }
    if (typeof base_price !== 'number' || typeof tax !== 'number' || typeof stock !== 'number') {
        return res.status(400).json({ error: 'base_price, tax, dan stock harus berupa angka (number)' });
    }

    try {
        // HITUNG HARGA FINAL
        const harga_final = calculateFinalPrice(base_price, tax);

        // Buat produk baru dengan struktur bersarang
        const newProduct = {
            id: productIdCounter++,
            details: {
                name: name,
                category: category
            },
            pricing: {
                base_price: base_price,
                tax: tax,
                harga_final: harga_final // ✅ Syarat terpenuhi: base_price + tax
            },
            stock: stock,
            created_by: req.user.username,
            created_at: new Date().toISOString()
        };

        products.push(newProduct);

        res.status(201).json({
            success: true,
            message: '✅ Produk berhasil ditambahkan!',
            data: newProduct
        });
    } catch (err) {
        res.status(400).json({ error: 'Gagal membuat produk: ' + err.message });
    }
});

// UPDATE Product (Protected - Hanya ADMIN)
app.put('/products/:id', [authenticateToken, authorizeRole('admin')], (req, res) => {
    const productId = parseInt(req.params.id);
    const { name, category, base_price, tax, stock } = req.body;

    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
        return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }

    try {
        const currentProduct = products[productIndex];

        // Tentukan nilai baru atau gunakan nilai lama
        const newBasePrice = base_price !== undefined ? base_price : currentProduct.pricing.base_price;
        const newTax = tax !== undefined ? tax : currentProduct.pricing.tax;
        
        // HITUNG ULANG HARGA FINAL
        const harga_final = calculateFinalPrice(newBasePrice, newTax);

        // Update product
        products[productIndex] = {
            ...currentProduct,
            details: {
                name: name || currentProduct.details.name,
                category: category || currentProduct.details.category
            },
            pricing: {
                base_price: newBasePrice,
                tax: newTax,
                harga_final: harga_final // ✅ Harga final diupdate
            },
            stock: stock !== undefined ? stock : currentProduct.stock,
            updated_by: req.user.username,
            updated_at: new Date().toISOString()
        };

        res.json({
            success: true,
            message: '✅ Produk berhasil diupdate!',
            data: products[productIndex]
        });
    } catch (err) {
        res.status(400).json({ error: 'Gagal mengupdate produk: ' + err.message });
    }
});

// DELETE Product (Protected - Hanya ADMIN)
app.delete('/products/:id', [authenticateToken, authorizeRole('admin')], (req, res) => {
    const productId = parseInt(req.params.id);
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
        return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }

    const deletedProduct = products.splice(productIndex, 1)[0];
    res.json({
        success: true,
        message: '✅ Produk berhasil dihapus!',
        deleted_product: deletedProduct
    });
});


// ============================================
// === ERROR HANDLING & START SERVER ===
// ============================================
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
    console.error('[ERROR]', err.stack);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Vendor C API berjalan di http://localhost:${PORT}`);
    console.log(`\n💡 Tip: Data produk KOSONG. Gunakan POST /seed (login sebagai admin) atau POST /products (setelah login) untuk mengisi data.`);
});