// express_server/index.js
// Express API server backed by SQLite with document + attribute versioning (tabs support)
//
// Works with:
// - GET /api/documents/:id/versions
// - GET /api/documents/:id/attributes?version=latest|<number>&includeVersion=1
// - Click attribute -> jump to changedInVersionNumber
// - Click version tab -> load attributes + PDF for that version

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
// Keep PORT=5000 so it matches your UI base URL (http://localhost:5000)
const PORT = process.env.PORT || 5000;

// DB + seed (paths are relative to this file)
const DB_FILE = process.env.DB_FILE || path.resolve(__dirname, 'data', 'contract_ai_versioned.db');
const SEED_FILE =
  process.env.SEED_FILE || path.resolve(__dirname, 'data', 'contract_ai_seed_versioned.sql');

// Serve PDFs so DB storageRef like "contracts/2024/x.pdf" works
// CONTRACTS_DIR must point to the folder that CONTAINS the "2024" folder.
const CONTRACTS_DIR =
  process.env.CONTRACTS_DIR || path.resolve(__dirname, '..', 'public', 'contracts');

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
  });
  db.exec('PRAGMA foreign_keys = ON;');
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

async function ensureSeeded() {
  // IMPORTANT:
  // sqlite OPEN_CREATE creates an empty DB file if missing, so checking "file exists" is not enough.
  // We check for required tables instead.
  const hasDocuments = await dbGet(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='documents' LIMIT 1`
  );
  const hasVersions = await dbGet(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='document_versions' LIMIT 1`
  );

  if (hasDocuments && hasVersions) return;

  if (!fs.existsSync(SEED_FILE)) {
    console.error(`Seed file not found at: ${SEED_FILE}`);
    process.exit(1);
  }

  const seedSql = fs.readFileSync(SEED_FILE, 'utf-8');
  await dbExec(seedSql);
  console.log('✅ SQLite database seeded from:', SEED_FILE);
}

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

// Compute "last changed in version" for each attributeKey across ALL versions (up to latest).
async function computeChangedInVersionNumber(documentId) {
  const latest = await getLatestVersion(documentId);
  const upTo = latest?.versionNumber || 1;

  const rows = await dbAll(
    `
      SELECT dv.versionNumber, a.attributeKey, a.extractedValue, a.correctedValue
      FROM attributes a
      JOIN document_versions dv ON dv.id = a.versionId
      WHERE a.documentId = ? AND dv.versionNumber <= ?
      ORDER BY a.attributeKey ASC, dv.versionNumber ASC
    `,
    [documentId, upTo]
  );

  const byAttr = new Map();
  for (const r of rows) {
    if (!byAttr.has(r.attributeKey)) byAttr.set(r.attributeKey, []);
    byAttr.get(r.attributeKey).push({ v: r.versionNumber, value: normalizeValue(r) });
  }

  const changedIn = {};
  for (const [attrKey, seq] of byAttr.entries()) {
    if (!seq.length) continue;
    let lastChanged = seq[0].v;
    let prev = seq[0].value;
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].value !== prev) {
        lastChanged = seq[i].v;
        prev = seq[i].value;
      }
    }
    changedIn[attrKey] = lastChanged;
  }
  return { changedIn, latestVersionNumber: upTo };
}

// =====================
// ROUTES
// =====================
app.get('/health', (req, res) => res.json({ ok: true }));

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

// GET /api/documents/:id/attributes?version=latest|3|2|1&includeVersion=1
app.get('/api/documents/:id/attributes', async (req, res) => {
  const documentId = req.params.id;
  const versionParam = String(req.query.version || 'latest').toLowerCase();
  const includeVersion = String(req.query.includeVersion || '1').toLowerCase(); // default ON

  try {
    const requestedVersion =
      versionParam === 'latest'
        ? await getLatestVersion(documentId)
        : await getVersionByNumber(documentId, Number(versionParam));

    if (!requestedVersion) return res.status(404).json({ error: 'Version not found' });

    // Always compute change-meta up to latest so attribute clicks can jump to the latest change version.
    const { changedIn, latestVersionNumber } = await computeChangedInVersionNumber(documentId);

    const rows = await dbAll(
      `
        SELECT
          id AS rowId,              -- unique row id (attributeKey--versionId)
          attributeKey AS id,       -- stable attribute key across versions (what UI should use)
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
      [documentId, requestedVersion.id]
    );

    const payloadAttributes = rows.map((a) => ({
      ...a,
      changedInVersionNumber: changedIn[a.id] || 1,
      latestVersionNumber,
    }));

    // Backward compatible: if includeVersion is not truthy, return array only
    if (includeVersion !== '1' && includeVersion !== 'true') {
      return res.json(payloadAttributes);
    }

    return res.json({
      documentId,
      effectiveVersionNumber: requestedVersion.versionNumber,
      latestVersionNumber,
      version: {
        id: requestedVersion.id,
        versionNumber: requestedVersion.versionNumber,
        isLatest: requestedVersion.isLatest,
        status: requestedVersion.status,
        createdAt: requestedVersion.createdAt,
        storageRef: requestedVersion.storageRef,
        storageUrl: toStorageUrl(req, requestedVersion.storageRef),
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

      // a.id is the stable attributeKey (e.g., "attr-012")
      const attributeKey = a.id;
      const rowId = a.rowId || `${attributeKey}--${version.id}`;

      const existing = await dbGet(
        `SELECT correctedValue FROM attributes WHERE id = ? AND versionId = ?`,
        [rowId, version.id]
      );

      await dbRun(`UPDATE attributes SET correctedValue = ? WHERE id = ? AND versionId = ?`, [
        a.correctedValue ?? null,
        rowId,
        version.id,
      ]);

      await dbRun(
        `INSERT INTO attribute_reviews (documentId, versionId, attributeKey, oldCorrectedValue, newCorrectedValue, reviewedBy, reviewedAt)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          documentId,
          version.id,
          attributeKey,
          existing ? existing.correctedValue : null,
          a.correctedValue ?? null,
          reviewedBy,
        ]
      );
    }

    await dbRun(`UPDATE documents SET status = ?, reviewedBy = ?, storageRef = ? WHERE id = ?`, [
      status,
      reviewedBy,
      version.storageRef,
      documentId,
    ]);

    await dbRun('COMMIT');
    res.json({ success: true, documentId, versionId: version.id, versionNumber: version.versionNumber });
  } catch (e) {
    console.error(e);
    try {
      await dbRun('ROLLBACK');
    } catch (_) {}
    res.status(500).json({ error: 'Failed to save review' });
  }
});

// =====================
// STARTUP
// =====================
(async function bootstrap() {
  await ensureSeeded();

  if (fs.existsSync(CONTRACTS_DIR)) {
    // Example: GET http://localhost:5000/contracts/2024/techstart-nda.pdf
    app.use('/contracts', express.static(CONTRACTS_DIR));
  } else {
    console.warn(
      `⚠️ CONTRACTS_DIR not found: ${CONTRACTS_DIR}\n` +
        `   Set env var CONTRACTS_DIR to your UI's public/contracts folder so PDFs load.`
    );
  }

  app.listen(PORT, () => console.log(`✅ API server listening on http://localhost:${PORT}`));
})().catch((e) => {
  console.error('Startup failed:', e);
  process.exit(1);
});
