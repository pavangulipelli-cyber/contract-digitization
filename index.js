// server/index.js
// Express API server backed by SQLite (contract_ai.db) with document versioning support

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// =====================
// CONFIG
// =====================
const DB_FILE = process.env.DB_FILE || path.resolve(__dirname, 'data', 'contract_ai.db');
const SEED_FILE = process.env.SEED_FILE || path.resolve(__dirname, 'data', 'contract_ai_seed_versioned.sql');

// Serve PDFs from the UI's public/ folder (so DB storageRef like "contracts/2024/x.pdf" works)
const CONTRACTS_DIR =
  process.env.CONTRACTS_DIR || path.resolve(__dirname, '..', 'public', 'contracts');

if (fs.existsSync(CONTRACTS_DIR)) {
  // Example: GET http://localhost:4000/contracts/2024/techstart-nda.pdf
  app.use('/contracts', express.static(CONTRACTS_DIR));
}

// Ensure data folder exists
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

// =====================
// DB helpers
// =====================
function openDb() {
  const db = new sqlite3.Database(DB_FILE, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
      console.error('Error opening database:', err);
      process.exit(1);
    }
    db.exec('PRAGMA foreign_keys = ON;');
    console.log('Connected to SQLite database:', DB_FILE);
  });
  return db;
}

const db = openDb();

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}
function dbExec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve(true)));
  });
}

async function seedDatabaseIfMissing() {
  if (fs.existsSync(DB_FILE)) return;

  if (!fs.existsSync(SEED_FILE)) {
    console.error(`DB missing at ${DB_FILE} and seed file not found at ${SEED_FILE}`);
    process.exit(1);
  }
  const seedSql = fs.readFileSync(SEED_FILE, 'utf-8');
  await dbExec(seedSql);
  console.log('SQLite database seeded from:', SEED_FILE);
}

// Kick off seed if needed
seedDatabaseIfMissing().catch((e) => {
  console.error('Seeding failed:', e);
  process.exit(1);
});

// Build URL to fetch PDF from this server
function toStorageUrl(req, storageRef) {
  if (!storageRef) return null;
  return `${req.protocol}://${req.get('host')}/${storageRef.replace(/^\/+/, '')}`;
}

async function getLatestVersion(documentId) {
  return await dbGet(
    `SELECT * FROM document_versions WHERE documentId = ? AND isLatest = 1 LIMIT 1`,
    [documentId]
  );
}

async function getVersionByNumber(documentId, versionNumber) {
  return await dbGet(
    `SELECT * FROM document_versions WHERE documentId = ? AND versionNumber = ? LIMIT 1`,
    [documentId, versionNumber]
  );
}

function normalizeValue(row) {
  const corrected = (row.correctedValue || '').trim();
  return corrected.length > 0 ? corrected : (row.extractedValue || '').trim();
}

async function computeChangedInVersionNumber(documentId, upToVersionNumber) {
  const rows = await dbAll(
    `
      SELECT dv.versionNumber, a.attributeKey, a.extractedValue, a.correctedValue
      FROM attributes a
      JOIN document_versions dv ON dv.id = a.versionId
      WHERE a.documentId = ? AND dv.versionNumber <= ?
      ORDER BY dv.versionNumber ASC
    `,
    [documentId, upToVersionNumber]
  );

  const byAttr = new Map();
  for (const r of rows) {
    if (!byAttr.has(r.attributeKey)) byAttr.set(r.attributeKey, []);
    byAttr.get(r.attributeKey).push({ v: r.versionNumber, value: normalizeValue(r) });
  }

  const changedIn = {};
  for (const [attrId, seq] of byAttr.entries()) {
    if (!seq.length) continue;
    let lastChanged = seq[0].v;
    let prev = seq[0].value;
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].value !== prev) {
        lastChanged = seq[i].v;
        prev = seq[i].value;
      }
    }
    changedIn[attrId] = lastChanged;
  }
  return changedIn;
}

// =====================
// ROUTES
// =====================
app.get('/health', (req, res) => res.json({ ok: true }));

// Documents list (latest pointers)
app.get('/api/documents', async (req, res) => {
  try {
    const docs = await dbAll(`SELECT * FROM documents ORDER BY uploadedAt DESC LIMIT 1000`);
    res.json(
      docs.map((d) => ({
        ...d,
        storageUrl: toStorageUrl(req, d.storageRef),
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Document detail + versions list
app.get('/api/documents/:id', async (req, res) => {
  const documentId = req.params.id;
  try {
    const doc = await dbGet(`SELECT * FROM documents WHERE id = ?`, [documentId]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const versions = await dbAll(
      `SELECT * FROM document_versions WHERE documentId = ? ORDER BY versionNumber DESC`,
      [documentId]
    );

    res.json({
      ...doc,
      storageUrl: toStorageUrl(req, doc.storageRef),
      versions: versions.map((v) => ({ ...v, storageUrl: toStorageUrl(req, v.storageRef) })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Versions for tabs
app.get('/api/documents/:id/versions', async (req, res) => {
  const documentId = req.params.id;
  try {
    const versions = await dbAll(
      `SELECT * FROM document_versions WHERE documentId = ? ORDER BY versionNumber DESC`,
      [documentId]
    );
    res.json(versions.map((v) => ({ ...v, storageUrl: toStorageUrl(req, v.storageRef) })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// Attributes (version aware)
// GET /api/documents/:id/attributes?version=latest|3|2|1
app.get('/api/documents/:id/attributes', async (req, res) => {
  const documentId = req.params.id;
  const versionParam = String(req.query.version || 'latest').toLowerCase();

  try {
    const version =
      versionParam === 'latest'
        ? await getLatestVersion(documentId)
        : await getVersionByNumber(documentId, Number(versionParam));

    if (!version) return res.status(404).json({ error: 'Version not found' });

    const changedIn = await computeChangedInVersionNumber(documentId, version.versionNumber);

    const rows = await dbAll(
      `
        SELECT
          id AS rowId,
          attributeKey AS id,
          documentId,
          versionId,
          name,
          category,
          section,
          page,
          confidenceScore,
          confidenceLevel,
          extractedValue,
          correctedValue,
          highlightedText
        FROM attributes
        WHERE documentId = ? AND versionId = ?
        ORDER BY attributeKey
      `,
      [documentId, version.id]
    );
    const payloadAttributes = rows.map((a) => ({
      ...a,
      changedInVersionNumber: changedIn[a.id] || 1, // drives "Changed in vX" badge
    }));

    const includeVersion = String(req.query.includeVersion || '').toLowerCase();
    const format = String(req.query.format || '').toLowerCase();

    // Backward compatible:
    // - Default returns attributes array (old UI)
    // - Use ?includeVersion=1 to get { documentId, version, attributes } (new UI with tabs)
    if (format === 'array' || (includeVersion !== '1' && includeVersion !== 'true')) {
      return res.json(payloadAttributes);
    }

    return res.json({
      documentId,
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        isLatest: version.isLatest,
        status: version.status,
        createdAt: version.createdAt,
        storageRef: version.storageRef,
        storageUrl: toStorageUrl(req, version.storageRef),
      },
      attributes: payloadAttributes,
    });

} catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch attributes' });
  }
});

// Export attributes (CSV/JSON)
// GET /api/documents/:id/attributes/export?format=csv|json&version=latest|3|2|1
app.get('/api/documents/:id/attributes/export', async (req, res) => {
  const documentId = req.params.id;
  const format = String(req.query.format || 'csv').toLowerCase();
  const versionParam = String(req.query.version || 'latest').toLowerCase();

  try {
    const version =
      versionParam === 'latest'
        ? await getLatestVersion(documentId)
        : await getVersionByNumber(documentId, Number(versionParam));

    if (!version) return res.status(404).json({ error: 'Version not found' });

    const rows = await dbAll(
      `
        SELECT
          attributeKey AS id,
          name,
          category,
          section,
          page,
          confidenceScore,
          confidenceLevel,
          extractedValue,
          correctedValue
        FROM attributes
        WHERE documentId = ? AND versionId = ?
        ORDER BY attributeKey
      `,
      [documentId, version.id]
    );

    if (format === 'json') {
      res.header('Content-Type', 'application/json');
      return res.send(JSON.stringify(rows || [], null, 2));
    }

    const headers = [
      'Attribute ID',
      'Name',
      'Category',
      'Section',
      'Page',
      'Confidence',
      'Extracted Value',
      'Corrected Value',
    ];

    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const csvRows = (rows || []).map((a) => [
      a.id,
      esc(a.name),
      esc(a.category),
      esc(a.section),
      String(a.page ?? ''),
      String(a.confidenceScore ?? ''),
      esc(a.extractedValue),
      esc(a.correctedValue),
    ]);

    const csvContent = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    res.header('Content-Type', 'text/csv');
    res.send(csvContent);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Save review (updates correctedValue in a specific version; defaults to latest)
// POST /api/documents/:id/review
// Body: { versionNumber?: 3, reviewedBy?: "name", status?: "Reviewed", attributes: [{ id: "attr-012", correctedValue: "..." }] }
app.post('/api/documents/:id/review', async (req, res) => {
  const documentId = req.params.id;
  const body = req.body || {};
  const reviewedBy = body.reviewedBy || 'web';
  const status = body.status || 'Reviewed';

  if (!Array.isArray(body.attributes)) {
    return res.status(400).json({ error: 'Invalid payload (attributes array required)' });
  }

  try {
    const version =
      body.versionNumber != null
        ? await getVersionByNumber(documentId, Number(body.versionNumber))
        : await getLatestVersion(documentId);

    if (!version) return res.status(404).json({ error: 'Version not found' });

    await dbRun('BEGIN');

    for (const a of body.attributes) {
      if (!a || !a.id) continue;

      const rowId = a.rowId || `${a.id}--${version.id}`;

      const existing = await dbGet(`SELECT correctedValue FROM attributes WHERE id = ?`, [rowId]);

      await dbRun(`UPDATE attributes SET correctedValue = ? WHERE id = ?`, [
        a.correctedValue ?? null,
        rowId,
      ]);

      await dbRun(
        `INSERT INTO attribute_reviews (documentId, versionId, attributeKey, oldCorrectedValue, newCorrectedValue, reviewedBy, reviewedAt)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          documentId,
          version.id,
          a.id,
          existing ? existing.correctedValue : null,
          a.correctedValue ?? null,
          reviewedBy,
        ]
      );
    }

    await dbRun(`UPDATE documents SET status = ?, reviewedBy = ? WHERE id = ?`, [
      status,
      reviewedBy,
      documentId,
    ]);

    await dbRun('COMMIT');

    res.json({ success: true, documentId, versionId: version.id, versionNumber: version.versionNumber });
  } catch (e) {
    console.error(e);
    try { await dbRun('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: 'Failed to save review' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`));
