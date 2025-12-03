require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db.js');                 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, authorizeRole } = require('./auth.js');

const app = express();
const router = express.Router();
const PORT = process.env.PORT || 3300;

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());

// PASANG ROUTER KE APP ✔ WAJIB ADA
app.use(router);

// Endpoint status 
app.get("/status", (req, res) => {
  res.json({ status: "API Vendor is running" });
});

/* =============================================================
   GET ALL PRODUCTS (Vendor B)
============================================================= */
router.get('/vendor-b/products', async (req, res, next) => {
  const sql = `
    SELECT 
      id,
      sku,
      product_name AS "productName",
      price,
      is_available AS "isAvailable",
      created_at
    FROM vendor_b_products
    ORDER BY id ASC
  `;

  try {
    const result = await db.query(sql);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* =============================================================
   GET PRODUCT BY ID
============================================================= */
router.get('/vendor-b/products/:id', async (req, res, next) => {
  const sql = `
    SELECT 
      id,
      sku,
      product_name AS "productName",
      price,
      is_available AS "isAvailable",
      created_at
    FROM vendor_b_products
    WHERE id = $1
  `;

  try {
    const result = await db.query(sql, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Produk tidak ditemukan" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* =============================================================
   CREATE PRODUCT
============================================================= */
router.post('/vendor-b/products', authenticateToken, async (req, res, next) => {
  const { sku, productName, price, isAvailable } = req.body;

  if (!sku || !productName || !price || !isAvailable) {
    return res.status(400).json({
      error: 'sku, productName, price, dan isAvailable wajib diisi'
    });
  }

  const sql = `
    INSERT INTO vendor_b_products (sku, product_name, price, is_available)
    VALUES ($1, $2, $3, $4)
    RETURNING id, sku, product_name AS "productName", price, is_available AS "isAvailable"
  `;

  try {
    const result = await db.query(sql, [
      sku,
      productName,
      price,
      isAvailable
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'SKU sudah digunakan' });
    }
    next(err);
  }
});

/* =============================================================
   UPDATE PRODUCT
============================================================= */
router.put('/vendor-b/products/:id',
  authenticateToken,
  authorizeRole('admin'),
  async (req, res, next) => {

    const { sku, productName, price, isAvailable } = req.body;

    const sql = `
      UPDATE vendor_b_products
      SET sku = $1, product_name = $2, price = $3, is_available = $4
      WHERE id = $5
      RETURNING id, sku, product_name AS "productName", price, is_available AS "isAvailable"
    `;

    try {
      const result = await db.query(sql, [
        sku,
        productName,
        price,
        isAvailable,
        req.params.id
      ]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Produk tidak ditemukan" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
});

/* =============================================================
   DELETE PRODUCT
============================================================= */
router.delete('/vendor-b/products/:id',
  authenticateToken,
  authorizeRole('admin'),
  async (req, res, next) => {

    const sql = `DELETE FROM vendor_b_products WHERE id = $1 RETURNING *`;

    try {
      const result = await db.query(sql, [req.params.id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Produk tidak ditemukan" });
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
});

// === FALLBACK & ERROR HANDLING ===
app.use((req, res) => {
  res.status(404).json({ error: 'Route tidak ditemukan' });
});

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

// === START SERVER ===
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server aktif di http://localhost:${PORT}`);
});
