require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// =============================
// PORT + DATABASE
// =============================
const PORT = process.env.PORT || 4000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// =============================
// URL Server M1, M2, M3 
// =============================

// Vendor A (Mahasiswa 1)
const VENDOR_A_URL = "http://localhost:3001/api/vendor-a/products";

// Vendor B (Mahasiswa 2)
const VENDOR_B_URL = "http://localhost:3300/vendor-b/fashion";

// Vendor C (Mahasiswa 3)
const VENDOR_C_URL = "http://localhost:3003/products";

// =============================
// NORMALISASI DATA
// =============================

// Vendor A → FORMAT: kd_produk, nm_brg, hrg, ket_stok
function mapVendorA(item) {
  return {
    sku: item.kd_produk,
    name: item.nm_brg,
    price: Number(item.hrg) * 0.9, // DISKON 10%
    available: item.ket_stok === "ada" ? "tersedia" : "tidak",
    vendor: "Vendor A",
    extra: null,
  };
}

// Vendor B → FORMAT: sku, productName, price, isAvailable
function mapVendorB(item) {
  return {
    sku: item.sku,
    name: item.productName,
    price: Number(item.price),
    available: item.isAvailable === true || item.isAvailable === "yes" ? "tersedia" : "tidak",
    vendor: "Vendor B",
    extra: null,
  };
}

// Vendor C → NESTED OBJECT
function mapVendorC(item) {
  return {
    sku: "C" + item.id, // Biar seragam
    name: item.details.name,
    price: item.pricing.harga_final,
    available: item.stock > 0 ? "tersedia" : "tidak",
    vendor: "Vendor C",
    extra: {
      category: item.details.category,
      recommended: item.details.category.toLowerCase() === "food"
    }
  };
}

// ========================================
//  GET AGGREGATED PRODUCTS
// ========================================
app.get("/products", async (req, res) => {
  try {
    const [aRes, bRes, cRes] = await Promise.all([
      axios.get(VENDOR_A_URL).catch(() => ({ data: [] })),
      axios.get(VENDOR_B_URL).catch(() => ({ data: [] })),
      axios.get(VENDOR_C_URL).catch(() => ({ data: [] })),
    ]);

    const vendorA = aRes.data.map(mapVendorA);
    const vendorB = bRes.data.map(mapVendorB);
    const vendorC = cRes.data.data ? cRes.data.data.map(mapVendorC) : [];

    const finalData = [...vendorA, ...vendorB, ...vendorC];

    // OPSIONAL: Simpan ke database aggregator
    await pool.query(
      `INSERT INTO aggregated_products (total_items, created_at)
       VALUES ($1, NOW())`,
      [finalData.length]
    );

    res.json({
      status: "success",
      total: finalData.length,
      data: finalData,
    });

  } catch (error) {
    console.error("Aggregator error:", error.message);
    res.status(500).json({ error: "Gagal menggabungkan data vendor" });
  }
});

// ========================================
app.listen(PORT, () => {
  console.log(`Aggregator running at http://localhost:${PORT}`);
});
