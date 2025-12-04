require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;

/* =============================
   BASE URL Vendor 1, 2, 3
============================= */
const VENDOR_A_URL = "http://localhost:3001/api/vendor-a/products";
const VENDOR_B_URL = "http://localhost:3300/vendor-b/fashion";
const VENDOR_C_URL = "http://localhost:3003/products";

/* =============================
   NORMALISASI VENDOR A
============================= */
function mapVendorA(item) {
  return {
    sku: item.kd_produk,
    name: item.nm_brg,
    price: Number(item.hrg) - Number(item.hrg) * 0.1, // discount 10%
    available: item.ket_stok === "ada" ? "tersedia" : "tidak",
    vendor: "Vendor A",
    extra: null
  };
}

/* =============================
   NORMALISASI VENDOR B
============================= */
function mapVendorB(item) {
  return {
    sku: item.sku,
    name: item.productName,
    price: item.price,
    available: item.isAvailable === "yes" ? "tersedia" : "tidak",
    vendor: "Vendor B",
    extra: null
  };
}

/* =============================
   NORMALISASI VENDOR C
   (dibuat fleksibel karena vendor C return {success, data})
============================= */
function mapVendorC(item) {
  return {
    sku: item.id,
    name: item.details?.name,
    price: item.pricing?.harga_final,
    available: item.stock > 0 ? "tersedia" : "tidak",
    vendor: "Vendor C",
    extra: {
      category: item.details?.category,
      recommended:
        item.details?.category?.toLowerCase() === "food" ? true : false
    }
  };
}

/* =============================
   FIX: HANDLING STRUKTUR DATA MISMATCH
============================= */
function extractDataVendorC(raw) {
  // vendor C bisa return array langsung → []
  if (Array.isArray(raw)) {
    return raw;
  }

  // vendor C bisa return: {success:true, total:3, data:[...]}
  if (raw?.data && Array.isArray(raw.data)) {
    return raw.data;
  }

  // fallback
  return [];
}

/* =============================
   ROUTE AGGREGATOR
============================= */
app.get("/products", async (req, res) => {
  try {
    const [A, B, C] = await Promise.all([
      axios.get(VENDOR_A_URL).catch(() => ({ data: [] })),
      axios.get(VENDOR_B_URL).catch(() => ({ data: [] })),
      axios.get(VENDOR_C_URL).catch(() => ({ data: [] }))
    ]);

    console.log("Raw Vendor A:", A.data);
    console.log("Raw Vendor B:", B.data);
    console.log("Raw Vendor C:", C.data);

    /** VENDOR A */
    const vendorA = Array.isArray(A.data)
      ? A.data.map(mapVendorA)
      : [];

    /** VENDOR B */
    const vendorB = Array.isArray(B.data)
      ? B.data.map(mapVendorB)
      : [];

    /** VENDOR C — fleksibel */
    const vendorCraw = extractDataVendorC(C.data);
    const vendorC = vendorCraw.map(mapVendorC);

    /** FINAL OUTPUT */
    const finalOutput = [...vendorA, ...vendorB, ...vendorC];

    res.json({
      status: "success",
      total: finalOutput.length,
      data: finalOutput
    });

  } catch (err) {
    console.error("Aggregator error:", err.message);
    res.status(500).json({ error: "Aggregator gagal mengambil data" });
  }
});

/* =============================
   RUN SERVER
============================= */
app.listen(PORT, () => {
  console.log(`Aggregator running at http://localhost:${PORT}`);
});
