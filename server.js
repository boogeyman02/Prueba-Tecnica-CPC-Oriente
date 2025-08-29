const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const { z } = require("zod");
const app = express();
const PORT = process.env.PORT || 2003;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

//bd
const db = new Database("inventario.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    precio REAL NOT NULL,
    stock INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Validaciones Zod
const createSchema = z.object({
  nombre: z.string().min(1, "nombre requerido"),
  precio: z.coerce.number().nonnegative("precio >= 0"),
  stock: z.coerce.number().int().nonnegative("stock >= 0"),
});

const updateSchema = z
  .object({
    nombre: z.string().min(1).optional(),
    precio: z.coerce.number().nonnegative().optional(),
    stock: z.coerce.number().int().nonnegative().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "No tienes datos para actualizar",
  });

// Rutas
// POST /productos -> Crear uno
app.post("/productos", (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.errors.map((e) => e.message).join(", ") });
  }
  const { nombre, precio, stock } = parsed.data;
  const stmt = db.prepare(
    "INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)"
  );
  const result = stmt.run(nombre, precio, stock);
  const producto = db
    .prepare("SELECT * FROM productos WHERE id = ?")
    .get(result.lastInsertRowid);
  res.status(201).json(producto);
});

// GET /productos -> Listar todos
app.get("/productos", (req, res) => {
  const productos = db
    .prepare("SELECT * FROM productos ORDER BY id DESC")
    .all();
  res.json(productos);
});

// GET /productos/:id -> Listar uno
app.get("/productos/:id", (req, res) => {
  const id = Number(req.params.id);
  const producto = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
  if (!producto)
    return res.status(404).json({ error: "Producto no encontrado" });
  res.json(producto);
});

// PUT /productos/:id -> Editar uno
app.put("/productos/:id", (req, res) => {
  const id = Number(req.params.id);
  const existente = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
  if (!existente)
    return res.status(404).json({ error: "Producto no encontrado" });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.errors.map((e) => e.message).join(", ") });
  }

  const datos = { ...existente, ...parsed.data };
  db.prepare(
    "UPDATE productos SET nombre = ?, precio = ?, stock = ? WHERE id = ?"
  ).run(datos.nombre, datos.precio, datos.stock, id);

  const actualizado = db
    .prepare("SELECT * FROM productos WHERE id = ?")
    .get(id);
  res.json(actualizado);
});

// DELETE /productos/:id -> Eliminar uno
app.delete("/productos/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM productos WHERE id = ?").run(id);
  if (info.changes === 0)
    return res.status(404).json({ error: "Producto no encontrado" });
  res.status(204).send(); // No Content
});

app.listen(PORT, () => {
  console.log(`API lista en http://localhost:${PORT}`);
});
