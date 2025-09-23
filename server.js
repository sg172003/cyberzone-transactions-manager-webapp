// server.js
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'transactions.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'receipts');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/receipts', express.static(RECEIPTS_DIR, { fallthrough: false }));

function ensureDirs() {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}
ensureDirs();

// Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (ok.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF or DOC/DOCX files are allowed'));
  }
});

// Helpers
function loadTransactions() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch {
    return [];
  }
}
function saveTransactions(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}
function parseDMY(d) {
  if (!d) return new Date(0);
  const [dd, mm, yyyy] = d.split('/');
  return new Date(+yyyy, +mm - 1, +dd);
}
function formatDMY(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function getRangeDates({ range, from, to }) {
  const now = new Date();
  const end = to ? parseDMY(to) : now;
  end.setHours(23, 59, 59, 999);
  let start;

  if (range === '1w') {
    start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (range === '1m') {
    start = new Date(end);
    start.setMonth(end.getMonth() - 1);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
  } else if (range === '3m') {
    start = new Date(end);
    start.setMonth(end.getMonth() - 3);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
  } else if (range === '6m') {
    start = new Date(end);
    start.setMonth(end.getMonth() - 6);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'custom') {
    start = from ? parseDMY(from) : new Date(0);
    start.setHours(0, 0, 0, 0);
  } else {
    start = new Date(0);
  }
  return { start, end };
}

const AADHAR_RE = /^\d{4}\s\d{4}\s\d{4}$/;
const PHONE_RE  = /^\d{10}$/;

function normalizeType(t) {
  const s = String(t || '').toLowerCase();
  if (s === 'deposit') return 'Deposit';
  if (s === 'withdrawal') return 'Withdrawal';
  if (s === 'atm') return 'ATM';
  return t || '';
}
function safeUnlink(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
}

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/transactions', (req, res) => {
  const { range, from, to } = req.query;
  const all = loadTransactions();
  if (!range && !from && !to) return res.json({ transactions: all });

  const { start, end } = getRangeDates({ range, from, to });
  const filtered = all.filter(t => {
    const d = parseDMY(t.date);
    return d >= start && d <= end;
  });
  res.json({ transactions: filtered });
});

app.post('/api/manual-entry', upload.single('receipt'), (req, res) => {
  try {
    const { date, name, transactionType, amount, aadharNumber = '', phone = '' } = req.body;
    if (!date || !name || !transactionType || !amount) {
      return res.status(400).json({ error: 'date, name, transactionType, amount are required' });
    }

    let aadharOut = (aadharNumber || '').trim();
    let phoneOut  = (phone || '').trim();

    if (aadharOut) {
      if (!AADHAR_RE.test(aadharOut)) {
        return res.status(400).json({ error: 'Invalid Aadhar number. Expected: 1234 5678 1234' });
      }
    } else {
      aadharOut = 'N/A';
    }

    if (phoneOut) {
      const digits = phoneOut.replace(/\D/g, '');
      if (digits.length !== 10) {
        return res.status(400).json({ error: 'Invalid phone number. Enter exactly 10 digits (e.g., 9876543210).' });
      }
      phoneOut = digits;
    } else {
      phoneOut = 'N/A';
    }

    const tx = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date: date.trim(),
      name: name.trim(),
      transactionType: normalizeType(transactionType),
      amount: Number(parseFloat(String(amount).replace(/,/g, '')).toFixed(2)),
      aadharNumber: aadharOut,
      phone: phoneOut,
      createdAt: new Date().toISOString()
    };

    if (req.file) {
      const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
      const safeExt = ['pdf', 'doc', 'docx'].includes(ext) ? ext : 'bin';
      const stored = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
      const fullPath = path.join(RECEIPTS_DIR, stored);
      fs.writeFileSync(fullPath, req.file.buffer);
      tx.receiptOriginalName = req.file.originalname;
      tx.receiptStoredName = stored;
      tx.receiptUrl = `/receipts/${stored}`;
    }

    const all = loadTransactions();
    all.push(tx);
    all.sort((a, b) => parseDMY(b.date) - parseDMY(a.date));
    saveTransactions(all);

    res.json({ added: 1, total: all.length, transaction: tx });
  } catch (e) {
    console.error('Manual-entry error:', e);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

app.put('/api/transactions/:id', upload.single('receipt'), (req, res) => {
  try {
    const id = req.params.id;
    const all = loadTransactions();
    const idx = all.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

    const { date, name, transactionType, amount, aadharNumber = '', phone = '' } = req.body;
    if (!date || !name || !transactionType || !amount) {
      return res.status(400).json({ error: 'date, name, transactionType, amount are required' });
    }

    let aadharOut = (aadharNumber || '').trim();
    let phoneOut  = (phone || '').trim();

    if (aadharOut) {
      if (!AADHAR_RE.test(aadharOut)) {
        return res.status(400).json({ error: 'Invalid Aadhar number. Expected: 1234 5678 1234' });
      }
    } else {
      aadharOut = 'N/A';
    }

    if (phoneOut) {
      const digits = phoneOut.replace(/\D/g, '');
      if (digits.length !== 10) {
        return res.status(400).json({ error: 'Invalid phone number. Enter exactly 10 digits (e.g., 9876543210).' });
      }
      phoneOut = digits;
    } else {
      phoneOut = 'N/A';
    }

    const tx = all[idx];
    tx.date = date.trim();
    tx.name = name.trim();
    tx.transactionType = normalizeType(transactionType);
    tx.amount = Number(parseFloat(String(amount).replace(/,/g, '')).toFixed(2));
    tx.aadharNumber = aadharOut;
    tx.phone = phoneOut;
    tx.updatedAt = new Date().toISOString();

    if (req.file) {
      if (tx.receiptStoredName) safeUnlink(path.join(RECEIPTS_DIR, tx.receiptStoredName));
      const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
      const safeExt = ['pdf', 'doc', 'docx'].includes(ext) ? ext : 'bin';
      const stored = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
      const fullPath = path.join(RECEIPTS_DIR, stored);
      fs.writeFileSync(fullPath, req.file.buffer);
      tx.receiptOriginalName = req.file.originalname;
      tx.receiptStoredName = stored;
      tx.receiptUrl = `/receipts/${stored}`;
    }

    all.sort((a, b) => parseDMY(b.date) - parseDMY(a.date));
    saveTransactions(all);

    res.json({ ok: true, transaction: tx });
  } catch (e) {
    console.error('Edit error:', e);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

app.delete('/api/transactions/:id', (req, res) => {
  try {
    const id = req.params.id;
    const all = loadTransactions();
    const idx = all.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

    const tx = all[idx];
    if (tx.receiptStoredName) safeUnlink(path.join(RECEIPTS_DIR, tx.receiptStoredName));

    all.splice(idx, 1);
    saveTransactions(all);
    res.json({ ok: true, total: all.length });
  } catch (e) {
    console.error('Delete error:', e);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Download Excel (clean: no receipt link)
app.get('/api/download-excel', (req, res) => {
  try {
    const { range, from, to } = req.query;
    const all = loadTransactions();
    const { start, end } = getRangeDates({ range, from, to });

    const filtered = all.filter(t => {
      const d = parseDMY(t.date);
      return d >= start && d <= end;
    });

    if (filtered.length === 0) {
      return res.status(400).json({ error: 'No data in selected range' });
    }

    const headers = ['Date', 'Name', 'Transaction Type', 'Amount', 'Aadhar Number', 'Phone Number'];
    const dataRows = filtered.map(t => [
      t.date, t.name, t.transactionType, Number(t.amount), t.aadharNumber || 'N/A', t.phone || 'N/A'
    ]);
    const aoa = [headers, ...dataRows];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = [
      { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }
    ];

    // Amount format
    const totalRows = aoa.length;
    for (let r = 2; r <= totalRows; r++) {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c: 3 });
      const cell = ws[addr];
      if (cell && typeof cell.v === 'number') {
        cell.t = 'n';
        cell.z = '#,##0.00';
      }
    }
    // Date format
    for (let r = 2; r <= totalRows; r++) {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c: 0 });
      const cell = ws[addr];
      if (cell && typeof cell.v === 'string') {
        const parts = cell.v.split('/');
        if (parts.length === 3) {
          const [dd, mm, yyyy] = parts.map(p => parseInt(p, 10));
          const jsDate = new Date(yyyy, mm - 1, dd);
          if (!isNaN(jsDate)) {
            cell.v = jsDate;
            cell.t = 'd';
            cell.z = 'dd/mm/yyyy';
          }
        }
      }
    }

    ws['!autofilter'] = { ref: `A1:F${filtered.length + 1}` };

    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const label =
      req.query.range === '1w' ? '1_week' :
      req.query.range === '1m' ? '1_month' :
      req.query.range === '3m' ? '3_months' :
      req.query.range === '6m' ? '6_months' :
      req.query.range === 'custom' ? `custom_${from || 'start'}_to_${to || 'now'}` : 'all';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=transactions_${label}.xlsx`);
    res.send(buf);
  } catch (e) {
    console.error('Excel error:', e);
    res.status(500).json({ error: 'Failed to generate Excel' });
  }
});

// Clear
app.post('/api/clear', (req, res) => {
  saveTransactions([]);
  res.json({ ok: true });
});

// Health
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date().toISOString() }));

// Start
app.listen(PORT, () => {
  console.log(`Manual-entry app running at http://localhost:${PORT}`);
});