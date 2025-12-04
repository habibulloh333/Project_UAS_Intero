import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;

// =============================
// BASE URL Server M1, M2, M3 
// =============================
const VENDOR_A_URL = "http://localhost:3001/api/vendor-a/products";
const VENDOR_B_URL = "http://localhost:3300/vendor-b/fashion";
const VENDOR_C_URL = "http://localhost:3003/products";

// =============================
// NORMALISASI VENDOR A
// =============================
function mapVendorA(item) {
    const originalPrice = parseInt(item.hrg);
    const finalPrice = originalPrice * 0.9;  // Diskon 10%

    return {
        vendor: "A",
        name: item.nm_brg,
        original_price: originalPrice,
        price: finalPrice,
        status: item.ket_stok === "ada" ? "Tersedia" : "Habis",
        label: "Diskon 10%"
    };
}
// =============================
// NORMALISASI VENDOR B
// =============================
function mapVendorB(item) {
    return {
        vendor: "B",
        name: item.productName,
        price: Number(item.price),
        status: item.isAvailable,
        label: null
    };
}

// =============================
// NORMALISASI VENDOR C
// =============================
function mapVendorC(item) {
    let name = item.details.name;

    // Tambah label Recommended jika kategori Food
    if (item.details.category.toLowerCase() === "food") {
        name += " (Recommended)";
    }

    return {
        vendor: "C",
        name: name,
        price: Number(item.pricing.harga_final),
        status: item.stock > 0 ? "Tersedia" : "Habis",
        label: item.details.category
    };
}

// =============================
// ENDPOINT AGGREGATOR UTAMA
// =============================
app.get("/all-products", async (req, res) => {
    try {
        const [aRes, bRes, cRes] = await Promise.all([
            axios.get(VENDOR_A_URL),
            axios.get(VENDOR_B_URL),
            axios.get(VENDOR_C_URL)
        ]);

        // Mapping hasil normalisasi
        const vendorA = aRes.data.map(mapVendorA);
        const vendorB = bRes.data.map(mapVendorB);
        const vendorC = cRes.data.data.map(mapVendorC);

        // Gabungkan semua
        const finalOutput = [...vendorA, ...vendorB, ...vendorC];

        res.json({
            total: finalOutput.length,
            data: finalOutput
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Gagal mengambil data vendor" });
    }
});

// =============================
// STATUS
// =============================
app.get("/", (req, res) => {
    res.json({ message: "Aggregator Mahasiswa 4 is running" });
});

// =============================
app.listen(PORT, () => {
    console.log(`Aggregator running at http://localhost:${PORT}`);
});
