require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// === Sesuaikan URL dengan server mahasiswa masing-masing ===
const URL_VENDOR_A = "http://localhost:3001/api/vendor-a/products";
const URL_VENDOR_B = "http://localhost:3300/vendor-b/fashion";
const URL_VENDOR_C = "http://localhost:3003/products";

// ============================================================
//                 FUNGSI NORMALISASI DATA
// ============================================================

// --- Normalisasi Vendor A (Mahasiswa 1) ---
function normalizeVendorA(item) {
  const harga = parseInt(item.hrg); // string → integer

  // diskon 10%
  const diskon = harga * 0.10;
  const harga_final = harga - diskon;

  return {
    id: item.kd_produk,
    name: item.nm_brg,
    price_final: harga_final,
    stock: item.ket_stok, // "ada" / "habis"
    vendor: "Vendor A"
  };
}

// --- Normalisasi Vendor B (Mahasiswa 2) ---
function normalizeVendorB(item) {
  return {
    id: item.sku,
    name: item.productName,
    price_final: item.price,
    stock: item.isAvailable ? "Tersedia" : "Tidak Tersedia",
    vendor: "Vendor B"
  };
}

// --- Normalisasi Vendor C (Mahasiswa 3) ---
function normalizeVendorC(item) {
  let finalName = item.details.name;

  // Tambahkan label Recommended jika Food
  if (item.details.category === "Food") {
    finalName += " (Recommended)";
  }

  return {
    id: item.id,
    name: finalName,
    price_final: item.pricing.base_price + item.pricing.tax,
    stock: item.stock,
    vendor: "Vendor C"
  };
}

// ============================================================
//               ROUTE UTAMA AGGREGASI DATA
// ============================================================

app.get("/aggregate", async (req, res) => {
  try {
    // --- Ambil data dari tiga vendor ---
    const [v1, v2, v3] = await Promise.all([
      axios.get(URL_VENDOR_A),
      axios.get(URL_VENDOR_B),
      axios.get(URL_VENDOR_C),
    ]);

    const vendorAData = v1.data.map(normalizeVendorA);
    const vendorBData = v2.data.map(normalizeVendorB);
    const vendorCData = v3.data.data
      ? v3.data.data.map(normalizeVendorC)
      : v3.data.map(normalizeVendorC);

    // Gabungkan semua menjadi satu format seragam
    const finalOutput = [
      ...vendorAData,
      ...vendorBData,
      ...vendorCData
    ];

    res.json({
      success: true,
      total: finalOutput.length,
      data: finalOutput
    });

  } catch (err) {
    console.error("ERROR AGGREGATOR:", err.message);
    res.status(500).json({ 
      success: false,
      error: "Gagal mengambil atau menggabungkan data vendor",
      details: err.message
    });
  }
});

// ============================================================
//                    JALANKAN SERVER
// ============================================================

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Integrator berjalan di http://localhost:${PORT}/aggregate`);
});
