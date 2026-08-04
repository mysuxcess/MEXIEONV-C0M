const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'mexieon.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    country TEXT DEFAULT 'United States',
    wallet_balance REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    emoji TEXT,
    quantity INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rfq_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    item TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    ship_to TEXT,
    company TEXT,
    contact TEXT NOT NULL,
    specs TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS hunter_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    item TEXT NOT NULL,
    brand TEXT,
    budget TEXT,
    contact TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'searching',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    emoji TEXT,
    category TEXT NOT NULL,
    vendor TEXT,
    rating REAL DEFAULT 4.5,
    reviews INTEGER DEFAULT 0,
    image TEXT,
    fallback_image TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trade_facility (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_amount REAL NOT NULL DEFAULT 5000000
  );
  INSERT OR IGNORE INTO trade_facility (id, total_amount) VALUES (1, 5000000);

  CREATE TABLE IF NOT EXISTS supplier_outreach (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    contact_email TEXT,
    category TEXT,
    supply_model TEXT,
    pay_terms TEXT,
    notes TEXT,
    include_funding INTEGER DEFAULT 0,
    funding_amount REAL DEFAULT 0,
    draft_subject TEXT,
    draft_body TEXT,
    status TEXT DEFAULT 'sent',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subtotal REAL NOT NULL,
    cashback REAL NOT NULL,
    status TEXT DEFAULT 'placed',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    emoji TEXT,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  -- ── V13 Orchestration Layer ──

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,           -- uuid
    title TEXT NOT NULL,           -- user's free-text request
    status TEXT DEFAULT 'planned', -- planned | running | awaiting_approval | approved | rejected | completed | failed
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS task_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    node_key TEXT NOT NULL,        -- e.g. 'architect', 'interior', 'procurement'
    agent_name TEXT NOT NULL,      -- e.g. 'ARCHITECT', 'COMPASS+HUNTER'
    status TEXT DEFAULT 'pending', -- pending | running | completed | failed | awaiting_approval
    input_json TEXT,               -- JSON: what this node consumes from context bus
    output_json TEXT,              -- JSON: structured output contract
    summary_text TEXT,             -- human-readable summary
    error_text TEXT,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS context_bus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    node_key TEXT NOT NULL,        -- which node produced this entry
    field_name TEXT NOT NULL,      -- e.g. 'conceptName', 'roomCount', 'furnishingPlan'
    field_value TEXT NOT NULL,     -- JSON-encoded value
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    from_node TEXT NOT NULL,
    to_node TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- Agent registry: defines every orchestratable agent's input/output contracts
  CREATE TABLE IF NOT EXISTS agent_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT UNIQUE NOT NULL,
    entity TEXT NOT NULL,
    role_desc TEXT NOT NULL,
    input_contract TEXT NOT NULL,  -- JSON schema array: [{field, type, description}]
    output_contract TEXT NOT NULL, -- JSON schema array: [{field, type, description}]
    system_prompt TEXT NOT NULL
  );
`);

module.exports = db;
