// ======================
// Mahasiswa 4 – API Gateway
// ======================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db.js');

const app = express();
const PORT = 3300;

app.use(cors());
app.use(express.json());

/* ============================================
   FORMATTER – Menyamakan semua vendor
============================================ */

// Vendor A (Mahasiswa 1)
const formatVendorAProduct = (p) => ({
    vendor: "Vendor A (Elektronik)",
    code: p.kd_produk,
    name: p.nm_brg,
    price: p.hrg,
    stock: p.ket_stok,
});

// Vendor B (Mahasiswa 2)
const formatVendorBProduct = (p) => ({
    vendor: "Vendor B (Fashion)",
    code: p.sku,
    name: p.productName,
    price: p.price,
    stock: p.isAvailable ? "ada" : "habis",
});

// Vendor C (Mahasiswa 3)
const formatVendorCProduct = (p) => ({
    vendor: "Vendor C (Resto)",
    code: p.id,
    name: p.name,
    price: p.harga_final,
    stock: p.stock > 0 ? "ada" : "habis",
    details: {
        base_price: p.base_price,
        tax: p.tax,
        category: p.category
    }
});

/* ============================================
   GET ALL PRODUCTS (Gabungan M1, M2, M3)
============================================ */

app.get('/all-products', async (req, res) => {
    try {
        // === Vendor A ===
        const resultA = await db.query(`
            SELECT kd_produk, nm_brg, hrg, ket_stok 
            FROM vendor_a_products
            ORDER BY kd_produk ASC
        `);
        const dataA = resultA.rows.map(formatVendorAProduct);

        // === Vendor B ===
        const resultB = await db.query(`
            SELECT 
                sku, 
                product_name AS "productName",
                price,
                is_available AS "isAvailable"
            FROM vendor_b_products
            ORDER BY sku ASC
        `);
        const dataB = resultB.rows.map(formatVendorBProduct);

        // === Vendor C ===
        const resultC = await db.query(`
            SELECT 
                id, name, category, 
                base_price, tax, harga_final, stock 
            FROM products
            ORDER BY id ASC
        `);
        const dataC = resultC.rows.map(formatVendorCProduct);

        // === Gabungkan semua ===
        const all = [...dataA, ...dataB, ...dataC];

        res.json({
            success: true,
            total: all.length,
            sources: ["Mahasiswa 1", "Mahasiswa 2", "Mahasiswa 3"],
            data: all
        });

    } catch (err) {
        console.error("GATEWAY ERROR:", err);
        res.status(500).json({ error: "Gagal membaca data gabungan" });
    }
});


/* ============================================
   START SERVER
============================================ */

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API Gateway Mahasiswa 4 berjalan di http://localhost:${PORT}`);
    console.log(`📌 Endpoint Gabungan: http://localhost:${PORT}/all-products`);
});
