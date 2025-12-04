// Mahasiswa 4 (API Gateway) - Revisi Code Vendor B
require('dotenv').config();
const express = require('express');
const cors = require('cors');
// Asumsi db.js adalah koneksi ke Neon (PostgreSQL Pool)
const db = require('./db.js'); 
const app = express();
const PORT = 3300; 

// Tambahkan Helper Function Anda (Mahasiswa 3) untuk menjaga format bersarang
// Ini penting agar data Anda tetap unik saat ditampilkan!
const formatVendorCProduct = (dbProduct) => ({
    id: dbProduct.id,
    vendor: "Vendor C (Resto)", // Tambahkan penanda vendor
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
});

// Fungsi untuk memformat data Vendor B (Flat)
const formatVendorBProduct = (dbProduct) => ({
    sku: dbProduct.sku,
    vendor: "Vendor B (Fashion)", // Tambahkan penanda vendor
    productName: dbProduct.productName,
    price: dbProduct.price,
    isAvailable: dbProduct.isAvailable,
});


// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());

// ... [Auth Routes tetap sama] ...

// [HAPUS endpoint lama app.get('/vendor-b/fashion', ...)]
// [HAPUS endpoint lama app.get('/vendor-b/fashion/:sku', ...)]

/* =============================================================
   GET ALL PRODUCTS (GATEWAY) - Menggabungkan Vendor B dan Vendor C
============================================================= */
app.get('/all-products', async (req, res, next) => {
    try {
        // 1. Ambil data dari Vendor B (Tabel vendor_b_products)
        const sqlB = `
            SELECT 
                sku, product_name AS "productName", price, is_available AS "isAvailable"
            FROM vendor_b_products
            ORDER BY sku ASC
        `;
        const resultB = await db.query(sqlB);
        const dataB = resultB.rows.map(formatVendorBProduct); // Memformat data Vendor B

        // 2. Ambil data dari Vendor C (Tabel products)
        // Kita ambil semua kolom yang diperlukan untuk format bersarang Anda
        const sqlC = `
            SELECT 
                id, name, category, base_price, tax, harga_final, stock, created_at
            FROM products
            ORDER BY id ASC
        `;
        const resultC = await db.query(sqlC);
        const dataC = resultC.rows.map(formatVendorCProduct); // Memformat data Vendor C (Bersarang)

        // 3. Gabungkan kedua data
        const allProducts = [...dataB, ...dataC];

        res.json({
            success: true,
            total: allProducts.length,
            vendor_status: "Gateway Aktif",
            data: allProducts
        });

    } catch (err) {
        console.error('[GATEWAY ERROR]', err.stack);
        // Error 42P01 berarti "relation does not exist" (Tabel belum dibuat)
        if (err.code === '42P01') { 
             return res.status(500).json({ 
                error: 'Gagal membaca data. Pastikan tabel vendor_b_products dan products sudah dibuat di database Neon.'
             });
        }
        next(err);
    }
});

// ... [CRUD Routes lainnya (POST, PUT, DELETE) Vendor B tetap dipertahankan] ...

// ... [FALLBACK & ERROR HANDLING] ...

// === START SERVER ===
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server API Gateway Mahasiswa 4 (M4) berjalan di http://localhost:${PORT}`);
    console.log(`📍 Endpoint Gabungan: http://localhost:${PORT}/all-products`);
});