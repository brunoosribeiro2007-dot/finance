const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

const app = express();
const PORT = 3000;

app.use(express.json());

const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

const db = new sqlite3.Database(path.join(__dirname, "finance.db"));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      recurrence TEXT NOT NULL CHECK(recurrence IN ('monthly', 'one_time')),
      transaction_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  const admin = await get(`SELECT * FROM users WHERE username = ?`, ["admin"]);

  if (!admin) {
    const passwordHash = await bcrypt.hash("1234", 10);
    const result = await run(
      `INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)`,
      ["Administrador", "admin", passwordHash]
    );

    const userId = result.lastID;

    await run(
      `INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)`,
      [userId, "Salário", "income"]
    );
    await run(
      `INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)`,
      [userId, "Freelance", "income"]
    );
    await run(
      `INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)`,
      [userId, "Moradia", "expense"]
    );
    await run(
      `INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)`,
      [userId, "Alimentação", "expense"]
    );
    await run(
      `INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)`,
      [userId, "Transporte", "expense"]
    );
    await run(
      `INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)`,
      [userId, "Saúde", "expense"]
    );
    await run(
      `INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)`,
      [userId, "Outros", "expense"]
    );

    console.log("Usuário inicial criado: admin / 1234");
  }
}

function buildDateFilter(dateFrom, dateTo) {
  const filters = [];
  const params = [];

  if (dateFrom) {
    filters.push("transaction_date >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    filters.push("transaction_date <= ?");
    params.push(dateTo);
  }

  return { filters, params };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Preencha nome, usuário e senha."
      });
    }

    const existing = await get(`SELECT id FROM users WHERE username = ?`, [username.trim()]);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Esse usuário já existe."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      `INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)`,
      [name.trim(), username.trim(), passwordHash]
    );

    const userId = result.lastID;

    const defaultCategories = [
      ["Salário", "income"],
      ["Freelance", "income"],
      ["Moradia", "expense"],
      ["Alimentação", "expense"],
      ["Transporte", "expense"],
      ["Saúde", "expense"],
      ["Outros", "expense"]
    ];

    for (const [nameValue, typeValue] of defaultCategories) {
      await run(
        `INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)`,
        [userId, nameValue, typeValue]
      );
    }

    return res.status(201).json({
      success: true,
      message: "Usuário criado com sucesso."
    });
  } catch (error) {
    console.error("register error:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao criar usuário."
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Informe usuário e senha."
      });
    }

    const user = await get(`SELECT * FROM users WHERE username = ?`, [username.trim()]);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Usuário ou senha inválidos."
      });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        message: "Usuário ou senha inválidos."
      });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username
      }
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({
      success: false,
      message: "Erro no login."
    });
  }
});

app.get("/api/categories/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const type = req.query.type;

    let sql = `SELECT * FROM categories WHERE user_id = ?`;
    const params = [userId];

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY name ASC`;

    const rows = await all(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error("categories error:", error);
    return res.status(500).json([]);
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const { user_id, name, type } = req.body;

    if (!user_id || !name || !type) {
      return res.status(400).json({
        success: false,
        message: "Preencha todos os campos da categoria."
      });
    }

    const result = await run(
      `INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)`,
      [Number(user_id), name.trim(), type]
    );

    return res.status(201).json({
      success: true,
      id: result.lastID
    });
  } catch (error) {
    console.error("create category error:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao criar categoria."
    });
  }
});

app.get("/api/transactions/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { dateFrom, dateTo } = req.query;

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    let sql = `
      SELECT
        t.*,
        c.name AS category_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ?
    `;

    const params = [userId, ...dateFilter.params];

    if (dateFilter.filters.length) {
      sql += ` AND ${dateFilter.filters.join(" AND ")}`;
    }

    sql += ` ORDER BY t.transaction_date DESC, t.id DESC`;

    const rows = await all(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error("transactions error:", error);
    return res.status(500).json([]);
  }
});

app.post("/api/transactions", async (req, res) => {
  try {
    const {
      user_id,
      category_id,
      type,
      description,
      amount,
      recurrence,
      transaction_date
    } = req.body;

    if (
      !user_id ||
      !type ||
      !description ||
      amount === undefined ||
      !recurrence ||
      !transaction_date
    ) {
      return res.status(400).json({
        success: false,
        message: "Preencha todos os campos obrigatórios."
      });
    }

    const result = await run(
      `
      INSERT INTO transactions
      (user_id, category_id, type, description, amount, recurrence, transaction_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        Number(user_id),
        category_id ? Number(category_id) : null,
        type,
        description.trim(),
        Number(amount),
        recurrence,
        transaction_date
      ]
    );

    return res.status(201).json({
      success: true,
      id: result.lastID
    });
  } catch (error) {
    console.error("create transaction error:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao salvar lançamento."
    });
  }
});

app.put("/api/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      category_id,
      type,
      description,
      amount,
      recurrence,
      transaction_date
    } = req.body;

    if (!type || !description || amount === undefined || !recurrence || !transaction_date) {
      return res.status(400).json({
        success: false,
        message: "Preencha todos os campos obrigatórios."
      });
    }

    await run(
      `
      UPDATE transactions
      SET category_id = ?, type = ?, description = ?, amount = ?, recurrence = ?, transaction_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        category_id ? Number(category_id) : null,
        type,
        description.trim(),
        Number(amount),
        recurrence,
        transaction_date,
        id
      ]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("update transaction error:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao atualizar lançamento."
    });
  }
});

app.delete("/api/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await run(`DELETE FROM transactions WHERE id = ?`, [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error("delete transaction error:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao excluir lançamento."
    });
  }
});

app.get("/api/goals/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const rows = await all(
      `SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC`,
      [userId]
    );
    return res.json(rows);
  } catch (error) {
    console.error("goals error:", error);
    return res.status(500).json([]);
  }
});

app.post("/api/goals", async (req, res) => {
  try {
    const { user_id, name, target_amount, deadline } = req.body;

    if (!user_id || !name || target_amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Preencha nome e valor da meta."
      });
    }

    const result = await run(
      `
      INSERT INTO goals (user_id, name, target_amount, deadline)
      VALUES (?, ?, ?, ?)
      `,
      [Number(user_id), name.trim(), Number(target_amount), deadline || null]
    );

    return res.status(201).json({
      success: true,
      id: result.lastID
    });
  } catch (error) {
    console.error("create goal error:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao criar meta."
    });
  }
});

app.delete("/api/goals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await run(`DELETE FROM goals WHERE id = ?`, [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error("delete goal error:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao excluir meta."
    });
  }
});

app.get("/api/dashboard/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { dateFrom, dateTo } = req.query;

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    let whereSql = `WHERE user_id = ?`;
    const params = [userId, ...dateFilter.params];

    if (dateFilter.filters.length) {
      whereSql += ` AND ${dateFilter.filters.join(" AND ")}`;
    }

    const totals = await get(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense,
        COUNT(*) AS total_transactions
      FROM transactions
      ${whereSql}
      `,
      params
    );

    const byCategory = await all(
      `
      SELECT
        COALESCE(c.name, 'Sem categoria') AS category,
        COALESCE(SUM(t.amount), 0) AS total
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ?
        AND t.type = 'expense'
        ${dateFilter.filters.length ? "AND " + dateFilter.filters.join(" AND ").replaceAll("transaction_date", "t.transaction_date") : ""}
      GROUP BY COALESCE(c.name, 'Sem categoria')
      ORDER BY total DESC
      `,
      params
    );

    const byMonth = await all(
      `
      SELECT
        substr(transaction_date, 1, 7) AS month_key,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
      FROM transactions
      ${whereSql}
      GROUP BY substr(transaction_date, 1, 7)
      ORDER BY month_key ASC
      `,
      params
    );

    const recurring = await get(
      `
      SELECT COUNT(*) AS recurring_count
      FROM transactions
      ${whereSql}
      AND recurrence = 'monthly'
      `,
      params
    );

    const goals = await all(
      `SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC`,
      [userId]
    );

    return res.json({
      totals: {
        income: Number(totals?.income || 0),
        expense: Number(totals?.expense || 0),
        total_transactions: Number(totals?.total_transactions || 0),
        profit: Number(totals?.income || 0) - Number(totals?.expense || 0)
      },
      byCategory,
      byMonth,
      recurringCount: Number(recurring?.recurring_count || 0),
      goals
    });
  } catch (error) {
    console.error("dashboard error:", error);
    return res.status(500).json({
      totals: { income: 0, expense: 0, total_transactions: 0, profit: 0 },
      byCategory: [],
      byMonth: [],
      recurringCount: 0,
      goals: []
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("database init error:", error);
  });