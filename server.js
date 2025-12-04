require("dotenv").config();
const axios = require("axios");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;

// =========================================
// API ENDPOINT MILIK MAHASISWA 1, 2, 3
// =========================================
const VENDOR_A_URL = "http://localhost:3001/api/vendor-a/products";
const VENDOR_B_URL = "http://localhost:3300/vendor-b/fashion";
const VENDOR_C_URL = "http://localhost:3003/products";

// =========================================
// NORMALISASI DATA
// =========================================

// Vendor A (Mahasiswa 1) – Diskon 10%
function mapVendorA(item) {
  return {
    sku: item.kd_produk,
    name: item.nm_brg,
    price: Number(item.hrg) - Number(item.hrg) * 0.1, // diskon 10%
    available: item.ket_stok === "ada" ? "tersedia" : "habis",
    vendor: "Vendor A",
    extra: null
  };
}

// Vendor B (Mahasiswa 2)
function mapVendorB(item) {
  return {
    sku: item.sku,
    name: item.productName,
    price: Number(item.price),
    available: item.isAvailable === "yes" ? "tersedia" : "tidak tersedia",
    vendor: "Vendor B",
    extra: null
  };
}

// Vendor C (Mahasiswa 3) — Nested Object + Label Recommended
function mapVendorC(item) {
  return {
    sku: item.id, // Vendor C tidak memiliki SKU, jadi pakai ID sebagai pengganti
    name: item.details.name,
    price: Number(item.pricing.harga_final),
    available: item.stock > 0 ? "tersedia" : "habis",
    vendor: "Vendor C",
    extra: {
      category: item.details.category,
      recommended: item.details.category.toLowerCase() === "food"
    }
  };
}

// =========================================
// ROUTE AGGREGATOR
// =========================================

app.get("/products", async (req, res) => {
  try {
    const [A, B, C] = await Promise.all([
      axios.get(VENDOR_A_URL).catch(() => ({ data: [] })),
      axios.get(VENDOR_B_URL).catch(() => ({ data: [] })),
      axios.get(VENDOR_C_URL).catch(() => ({ data: [] }))
    ]);

    const vendorA = A.data.map(mapVendorA);
    const vendorB = B.data.map(mapVendorB);
    const vendorC = C.data.data
      ? C.data.data.map(mapVendorC)
      : C.data.map(mapVendorC);

    const merged = [...vendorA, ...vendorB, ...vendorC];

    res.json({
      status: "success",
      total: merged.length,
      data: merged
    });

  } catch (err) {
    console.error("Aggregator Error:", err.message);
    res.status(500).json({ error: "Aggregator gagal mengambil data vendor" });
  }
});

// =========================================
// START SERVER
// =========================================

app.listen(PORT, () => {
  console.log(`Aggregator running at http://localhost:${PORT}`);
});
