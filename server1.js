require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db.js"); // Impor koneksi database Anda
// Komentar middleware jika tidak digunakan untuk endpoint Vendor A
// const {
//   authenticateToken,
//   authorizeRole,
// } = require("./middleware/middleware/auth.js");

const app = express();
const PORT = process.env.PORT || 3300;
// const JWT_SECRET = process.env.JWT_SECRET; // Tidak digunakan di endpoint Vendor A

app.use(cors());
app.use(express.json());

// Endpoint status (dari template)
app.get("/status", (req, res) => {
  res.json({ status: "API Vendor A is running" });
});

// --- Endpoint CRUD untuk Vendor A (Mahasiswa 1) dengan Database ---
// Catatan: Otentikasi diabaikan untuk endpoint ini sesuai spesifikasi legacy.

// 1. GET All Products (Vendor A)
// Endpoint: GET /api/vendor-a/products
app.get("/api/vendor-a/products", async (req, res, next) => {
  console.log("[GET /api/vendor-a/products] Fetching all products from DB");
  const sql = "SELECT kd_produk, nm_brg, hrg, ket_stok FROM vendor_a_products ORDER BY kd_produk ASC";

  try {
    const result = await db.query(sql);
    res.json(result.rows); // Mengembalikan array produk
  } catch (err) {
    console.error("Database error on GET all products:", err);
    next(err); // Lempar error ke error handler global
  }
});

// 2. GET Product by ID (kd_produk) (Vendor A)
// Endpoint: GET /api/vendor-a/products/:kd_produk
app.get("/api/vendor-a/products/:kd_produk", async (req, res, next) => {
  const { kd_produk } = req.params;
  console.log(`[GET /api/vendor-a/products/${kd_produk}] Fetching product from DB`);

  const sql = "SELECT kd_produk, nm_brg, hrg, ket_stok FROM vendor_a_products WHERE kd_produk = $1";
  const values = [kd_produk];

  try {
    const result = await db.query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Produk dengan kd_produk ${kd_produk} tidak ditemukan.` });
    }

    res.json(result.rows[0]); // Mengembalikan satu produk
  } catch (err) {
    console.error("Database error on GET product by ID:", err);
    next(err);
  }
});

// 3. POST Create New Product (Vendor A)
// Endpoint: POST /api/vendor-a/products
// Body: { "kd_produk": "A004", "nm_brg": "...", "hrg": "...", "ket_stok": "..." }
app.post("/api/vendor-a/products", async (req, res, next) => {
  const { kd_produk, nm_brg, hrg, ket_stok } = req.body;
  console.log("[POST /api/vendor-a/products] Creating new product in DB:", req.body);

  // Validasi input sederhana
  if (!kd_produk || !nm_brg || !hrg || !ket_stok) {
    return res.status(400).json({ error: "Semua field (kd_produk, nm_brg, hrg, ket_stok) wajib diisi." });
  }

  // Validasi tipe data string
  if (typeof kd_produk !== 'string' || typeof nm_brg !== 'string' || typeof hrg !== 'string' || typeof ket_stok !== 'string') {
     return res.status(400).json({ error: "Semua field harus berupa string." });
  }

  // Validasi nilai ket_stok
  if (ket_stok !== "ada" && ket_stok !== "habis") {
     return res.status(400).json({ error: "ket_stok harus 'ada' atau 'habis'." });
  }

  const sql = "INSERT INTO vendor_a_products (kd_produk, nm_brg, hrg, ket_stok) VALUES ($1, $2, $3, $4) RETURNING *";
  const values = [kd_produk, nm_brg, hrg, ket_stok]; // Urutan sesuai placeholder $1, $2, $3, $4

  try {
    const result = await db.query(sql, values);
    res.status(201).json(result.rows[0]); // Mengembalikan produk yang baru dibuat
  } catch (err) {
    if (err.code === "23505") { // Error code untuk unique_violation di PostgreSQL
      return res.status(409).json({ error: `Produk dengan kd_produk ${kd_produk} sudah ada.` });
    }
    console.error("Database error on POST new product:", err);
    next(err);
  }
});

// 4. PUT Update Product by ID (Vendor A)
// Endpoint: PUT /api/vendor-a/products/:kd_produk
// Body: { "nm_brg": "...", "hrg": "...", "ket_stok": "..." } (kd_produk tidak bisa diubah)
app.put("/api/vendor-a/products/:kd_produk", async (req, res, next) => {
  const { kd_produk } = req.params;
  const { nm_brg, hrg, ket_stok } = req.body; // kd_produk tidak diambil dari body
  console.log(`[PUT /api/vendor-a/products/${kd_produk}] Updating product in DB with data:`, req.body);

  // Validasi input sederhana
  if (!nm_brg || !hrg || !ket_stok) {
    return res.status(400).json({ error: "Field nm_brg, hrg, dan ket_stok wajib diisi untuk update." });
  }

  // Validasi tipe data string
  if (typeof nm_brg !== 'string' || typeof hrg !== 'string' || typeof ket_stok !== 'string') {
     return res.status(400).json({ error: "Field nm_brg, hrg, dan ket_stok harus berupa string." });
  }

  // Validasi nilai ket_stok
  if (ket_stok !== "ada" && ket_stok !== "habis") {
     return res.status(400).json({ error: "ket_stok harus 'ada' atau 'habis'." });
  }

  const sql = "UPDATE vendor_a_products SET nm_brg = $1, hrg = $2, ket_stok = $3 WHERE kd_produk = $4 RETURNING *";
  const values = [nm_brg, hrg, ket_stok, kd_produk]; // Urutan sesuai placeholder

  try {
    const result = await db.query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Produk dengan kd_produk ${kd_produk} tidak ditemukan.` });
    }

    res.json(result.rows[0]); // Mengembalikan produk yang telah diperbarui
  } catch (err) {
    console.error("Database error on PUT update product:", err);
    next(err);
  }
});

// 5. DELETE Product by ID (Vendor A)
// Endpoint: DELETE /api/vendor-a/products/:kd_produk
app.delete("/api/vendor-a/products/:kd_produk", async (req, res, next) => {
  const { kd_produk } = req.params;
  console.log(`[DELETE /api/vendor-a/products/${kd_produk}] Deleting product from DB`);

  const sql = "DELETE FROM vendor_a_products WHERE kd_produk = $1 RETURNING *";
  const values = [kd_produk];

  try {
    const result = await db.query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Produk dengan kd_produk ${kd_produk} tidak ditemukan.` });
    }

    res.json({ message: `Produk dengan kd_produk ${kd_produk} berhasil dihapus.`, deletedProduct: result.rows[0] });
  } catch (err) {
    console.error("Database error on DELETE product:", err);
    next(err);
  }
});
// --- Akhir Endpoint CRUD Vendor A ---

// --- Bagian Otentikasi & CRUD Lainnya (dari template) ---
// app.post("/auth/register", async (req, res, next) => { ... });
// app.post("/auth/register-admin", async (req, res, next) => { ... });
// app.post("/auth/login", async (req, res, next) => { ... });
// app.get("/movies", async (req, res, next) => { ... });
// app.get("/movies/:id", async (req, res, next) => { ... });
// app.post("/movies", authenticateToken, async (req, res, next) => { ... });
// app.put("/movies/:id", [authenticateToken, authorizeRole("admin")], async (req, res, next) => { ... });
// app.delete("/movies/:id", [authenticateToken, authorizeRole("admin")], async (req, res, next) => { ... });
// app.get("/directors", async (req, res, next) => { ... });
// app.get("/directors/:id", async (req, res, next) => { ... });
// app.post("/directors", [authenticateToken], async (req, res, next) => { ... });
// app.put("/directors/:id", [authenticateToken, authorizeRole("admin")], async (req, res, next) => { ... });
// app.delete("/directors/:id", [authenticateToken, authorizeRole("admin")], async (req, res, next) => { ... });
// --- Akhir Bagian Lainnya ---

// 404 Handler (dari template)
app.use((req, res) => {
  res.status(404).json({ error: "Rute tidak ditemukan" });
});

// Error Handler (dari template)
app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]", err.stack);
  res.status(500).json({ error: "Terjadi kesalahan pada server" });
});

// Jalankan server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server Vendor A (Mahasiswa 1) berjalan di http://localhost:${PORT}`);
});

module.exports = app;