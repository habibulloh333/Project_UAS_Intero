require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { authenticateToken, authorizeRole } = require("./auth");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());


const vendorB = require("./server2.js");
const vendorC = require("./server3.js");


function normalizeVendorB(data) {
  return data.map((item) => ({
    id: item.sku,
    name: item.productName,
    price: item.price,
    stock: item.isAvailable ? "Tersedia" : "Habis",
    vendor: "Vendor B",
  }));
}

function normalizeVendorC(data) {
  return data.map((item) => {
    const hargaFinal =
      item.pricing.base_price + item.pricing.tax;

    let name = item.details.name;
    if (item.details.category === "Food") {
      name += " (Recommended)";
    }

    return {
      id: item.id,
      name,
      price: hargaFinal,
      stock: item.stock,
      vendor: "Vendor C",
    };
  });
}

function getAllProducts() {
  return [
    ...normalizeVendorB(vendorB),
    ...normalizeVendorC(vendorC)
  ];
}


app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Dummy user (bisa nanti kamu ambil dari database)
  const users = [
    { id: 1, username: "admin", password: "admin123", role: "admin" },
    { id: 2, username: "user", password: "user123", role: "user" }
  ];

  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Username atau password salah" });
  }

  const token = jwt.sign(
    { user: { id: user.id, username: user.username, role: user.role }},
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({ message: "Login berhasil", token });
});




app.get("/", (req, res) => {
  res.send("Integrator API berjalan dengan baik!");
});


app.get("/products", (req, res) => {
  res.json(getAllProducts());
});


app.get("/vendor/b", authenticateToken, (req, res) => {
  res.json(normalizeVendorB(vendorB));
});


app.get("/vendor/c", authenticateToken, (req, res) => {
  res.json(normalizeVendorC(vendorC));
});


app.get("/products/:id", authenticateToken, (req, res) => {
  const id = req.params.id;
  const found = getAllProducts().find((item) => String(item.id) === id);

  if (!found) {
    return res.status(404).json({ error: "Produk tidak ditemukan" });
  }
  res.json(found);
});


app.get("/admin/dashboard",
  authenticateToken,
  authorizeRole("admin"),
  (req, res) => {
    res.json({ message: "Selamat datang Admin!", user: req.user });
  }
);

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});