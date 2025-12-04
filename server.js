require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios"); // Gunakan npm install axios
const app = express();
const PORT = 5000; // Port untuk Lead Integrator

app.use(cors());
app.use(express.json());

// --- Fungsi Normalisasi ---
const normalizeProduct = (product, source) => {
  let normalized = {
    source: source,
    id: null,
    name: "",
    price: 0,
    stock_status: "Habis" // Default jika tidak bisa ditentukan
  };

  switch (source) {
    case 'Vendor A':
      normalized.id = product.kd_produk;
      normalized.name = product.nm_brg;
      // 2. Data dari M1 harus diubah dari string "15000" menjadi integer 15000.
      // 3. Data dari M1 status "ada" harus tetap, tapi "habis" harus dipastikan konsisten.
      normalized.price = Math.round(parseFloat(product.hrg));
      normalized.stock_status = product.ket_stok;
      // 6. Jika produk berasal dari Vendor A (Warung) , berikan Diskon 10% pada harga_final.
      normalized.price = Math.round(normalized.price * 0.9);
      break;

    case 'Vendor B':
      normalized.id = product.sku;
      normalized.name = product.productName;
      normalized.price = product.price;
      // 4. Data dari M2 status true harus diubah jadi string "Tersedia".
      normalized.stock_status = product.isAvailable ? "Tersedia" : "Habis";
      // 8. Produk dari Vendor B tidak ada perubahan (selain mapping status).
      break;

    case 'Vendor C':
      normalized.id = product.id;
      normalized.name = product.details.name;
      // 5. Data dari M3 harga harus dijumlahkan (base_price + tax) menjadi harga_final.
      normalized.price = product.pricing.base_price + product.pricing.tax;
      // 7. Jika produk berasal dari Vendor C (Resto) , dan kategorinya adalah "Food", tambahkan label "(Recommended)" di belakang nama produk.
      if (product.details.category === "Food") {
        normalized.name = `${normalized.name} (Recommended)`;
      }
      // Asumsi stock > 0 berarti Tersedia
      normalized.stock_status = product.stock > 0 ? "Tersedia" : "Habis";
      break;

    default:
      console.error(`Sumber tidak dikenal: ${source}`);
  }
  return normalized;
};

// --- Endpoint untuk mengambil dan menormalisasi data dari semua vendor ---
app.get("/api/products/normalized", async (req, res) => {
  try {
    console.log("Mengambil data dari semua vendor...");

    // Ambil data dari ketiga API vendor
    const [responseA, responseB, responseC] = await Promise.allSettled([
    axios.get("http://localhost:3001/api/vendor-a/products"), // Pastikan port 3001 benar
    axios.get("http://localhost:3300/vendor-b/fashion"),      // Port 3300 untuk M2
    axios.get("http://localhost:3003/products")               // Port 3003 untuk M3
    ]);

    const dataA = responseA.status === 'fulfilled' ? responseA.value.data : [];
    const dataB = responseB.status === 'fulfilled' ? responseB.value.data : [];
    const dataC = responseC.status === 'fulfilled' ? responseC.value.data.data || responseC.value.data : []; // M3 mungkin punya wrapper 'data'

    console.log(`Data dari Vendor A: ${dataA.length} item`);
    console.log(`Data dari Vendor B: ${dataB.length} item`);
    console.log(`Data dari Vendor C: ${dataC.length} item`);

    // Gabungkan semua data
    const allProducts = [
      ...dataA.map(p => ({ ...p, source: 'Vendor A' })),
      ...dataB.map(p => ({ ...p, source: 'Vendor B' })),
      ...dataC.map(p => ({ ...p, source: 'Vendor C' }))
    ];

    // ... setelah Promise.allSettled
console.log("=== DEBUG ===");
console.log("Response A Status:", responseA.status);
if (responseA.status === 'rejected') {
  console.log("Error from Vendor A:", responseA.reason);
}
console.log("Response B Status:", responseB.status);
if (responseB.status === 'rejected') {
  console.log("Error from Vendor B:", responseB.reason);
}
console.log("Response C Status:", responseC.status);
if (responseC.status === 'rejected') {
  console.log("Error from Vendor C:", responseC.reason);
}
console.log("=== END DEBUG ===");

    // Normalisasi setiap produk
    const normalizedProducts = allProducts.map(product => normalizeProduct(product, product.source));

    console.log(`Data Normalisasi Selesai. Total Produk: ${normalizedProducts.length}`);

    // Kirim hasil normalisasi
    res.json(normalizedProducts);

  } catch (error) {
    console.error("Error saat mengambil atau menormalisasi data:", error);
    res.status(500).json({ error: "Terjadi kesalahan saat mengambil data dari vendor." });
  }
});

// Endpoint status untuk M4
app.get("/status", (req, res) => {
  res.json({ status: "Lead Integrator API is running" });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: "Rute tidak ditemukan" });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]", err.stack);
  res.status(500).json({ error: "Terjadi kesalahan pada server Lead Integrator" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server Lead Integrator (Mahasiswa 4) berjalan di http://localhost:${PORT}`);
});

module.exports = app;