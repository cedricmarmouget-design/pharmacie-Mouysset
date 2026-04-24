const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { v4: uuid } = require('uuid');
const Datastore = require('@seald-io/nedb');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── DATABASES ────────────────────────────────────────────────────────────────
const db = {
  users:   new Datastore({ filename: path.join(__dirname, 'data/users.db'),   autoload: true }),
  tasks:   new Datastore({ filename: path.join(__dirname, 'data/tasks.db'),   autoload: true }),
  checks:  new Datastore({ filename: path.join(__dirname, 'data/checks.db'),  autoload: true }),
  history: new Datastore({ filename: path.join(__dirname, 'data/history.db'), autoload: true }),
};

// Indexes
db.checks.ensureIndex({ fieldName: 'taskId' });
db.checks.ensureIndex({ fieldName: 'date' });
db.history.ensureIndex({ fieldName: 'date' });
db.history.ensureIndex({ fieldName: 'createdAt' });

// Promisify NeDB
const q = (store, method, ...args) => new Promise((res, rej) => {
  store[method](...args, (err, result) => err ? rej(err) : res(result));
});

// ─── SEED DEFAULT DATA ────────────────────────────────────────────────────────
async function seed() {
  const userCount = await q(db.users, 'count', {});
  if (userCount === 0) {
    const defaultUsers = [
      { _id: uuid(), name: 'Mathieu',  role: 'Référent – 6h30',   color: '#0077B6', active: true, isAdmin: true,  createdAt: Date.now() },
      { _id: uuid(), name: 'Maryline', role: 'Logistique – 7h30', color: '#2E7D32', active: true, isAdmin: false, createdAt: Date.now() },
      { _id: uuid(), name: 'Marion',   role: 'Logistique – 7h45', color: '#AD1457', active: true, isAdmin: false, createdAt: Date.now() },
    ];
    for (const u of defaultUsers) await q(db.users, 'insert', u);
    console.log('✅ Users seeded');
  }

  const taskCount = await q(db.tasks, 'count', {});
  if (taskCount === 0) {
    const defaultTasks = [
      { _id: uuid(), name: 'Remplissage du robot',                              section: 'Matin',        sectionOrder: 1, order: 1,  time: '6h30',       priority: 1, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Réception commande OCP (fin avant 8h30)',           section: 'Matin',        sectionOrder: 1, order: 2,  time: '7h00–8h30',  priority: 1, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Rangement des pickings — 1ère vague',               section: 'Matin',        sectionOrder: 1, order: 3,  time: '7h45–9h30',  priority: 1, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Pilotage & dispatch dynamique',                     section: 'Flux Principal',sectionOrder: 2, order: 1,  time: '9h30',       priority: 1, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Réception commandes grossistes',                    section: 'Flux Principal',sectionOrder: 2, order: 2,  time: '9h30–11h30', priority: 1, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Façing — Étiquettes électroniques',                 section: 'Flux Principal',sectionOrder: 2, order: 3,  time: '9h30–11h30', priority: 2, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Façing — Contrôle stocks & capacités rayon',        section: 'Flux Principal',sectionOrder: 2, order: 4,  time: '9h30–11h30', priority: 2, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Façing — Implantation produits / nouveautés',       section: 'Flux Principal',sectionOrder: 2, order: 5,  time: '9h30–11h30', priority: 2, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Façing — Gestion des anomalies & périmés',          section: 'Flux Principal',sectionOrder: 2, order: 6,  time: '9h30–11h30', priority: 2, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Façing — Suivi des ruptures',                       section: 'Flux Principal',sectionOrder: 2, order: 7,  time: '9h30–11h30', priority: 2, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Rangement des pickings — 2ème vague (avant 12h30)', section: '2ème Vague',   sectionOrder: 3, order: 1,  time: '11h30–12h30',priority: 1, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Réception commandes grossistes (après-midi)',        section: 'Après-midi',   sectionOrder: 4, order: 1,  time: 'Après-midi', priority: 1, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Réception commandes directes laboratoires',         section: 'Après-midi',   sectionOrder: 4, order: 2,  time: 'Après-midi', priority: 1, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Contrôle rigoureux BL directs labos',               section: 'Après-midi',   sectionOrder: 4, order: 3,  time: 'Après-midi', priority: 1, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Missions façings espace de vente',                  section: 'Après-midi',   sectionOrder: 4, order: 4,  time: 'Après-midi', priority: 2, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Gestion des litiges fournisseurs',                  section: 'Selon Besoin', sectionOrder: 5, order: 1,  time: 'Selon besoin',priority: 3, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Paramétrage étiquettes électroniques',              section: 'Selon Besoin', sectionOrder: 5, order: 2,  time: 'Selon besoin',priority: 3, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Contrôle des stocks & délottage',                   section: 'Selon Besoin', sectionOrder: 5, order: 3,  time: 'Selon besoin',priority: 3, active: true, createdAt: Date.now() },
      { _id: uuid(), name: 'Préparation des promis clients',                    section: 'Selon Besoin', sectionOrder: 5, order: 4,  time: 'Selon besoin',priority: 3, active: true, createdAt: Date.now() },
    ];
    for (const t of defaultTasks) await q(db.tasks, 'insert', t);
    console.log('✅ Tasks seeded');
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── ROUTES: USERS ────────────────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    const users = await q(db.users, 'find', { active: true });
    users.sort((a, b) => a.createdAt - b.createdAt);
    res.json(users);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, role, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const user = { _id: uuid(), name, role: role || '', color: color || '#607D8B', active: true, isAdmin: false, createdAt: Date.now() };
    await q(db.users, 'insert', user);
    res.json(user);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, role, color, active, isAdmin } = req.body;
    const update = {};
    if (name  !== undefined) update.name    = name;
    if (role  !== undefined) update.role    = role;
    if (color !== undefined) update.color   = color;
    if (active!== undefined) update.active  = active;
    if (isAdmin!==undefined) update.isAdmin = isAdmin;
    await q(db.users, 'update', { _id: req.params.id }, { $set: update }, {});
    const user = await q(db.users, 'findOne', { _id: req.params.id });
    res.json(user);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await q(db.users, 'update', { _id: req.params.id }, { $set: { active: false } }, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── ROUTES: TASKS ────────────────────────────────────────────────────────────
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await q(db.tasks, 'find', { active: true });
    tasks.sort((a, b) => a.sectionOrder - b.sectionOrder || a.order - b.order);
    res.json(tasks);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { name, section, sectionOrder, time, priority } = req.body;
    if (!name || !section) return res.status(400).json({ error: 'name and section required' });
    // Find next order in section
    const existing = await q(db.tasks, 'find', { section, active: true });
    const maxOrder = existing.reduce((m, t) => Math.max(m, t.order || 0), 0);
    const task = {
      _id: uuid(), name, section,
      sectionOrder: sectionOrder || 99,
      order: maxOrder + 1,
      time: time || '',
      priority: priority || 2,
      active: true,
      createdAt: Date.now()
    };
    await q(db.tasks, 'insert', task);
    res.json(task);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { name, section, sectionOrder, time, priority, active, order } = req.body;
    const update = {};
    if (name         !== undefined) update.name         = name;
    if (section      !== undefined) update.section      = section;
    if (sectionOrder !== undefined) update.sectionOrder = sectionOrder;
    if (time         !== undefined) update.time         = time;
    if (priority     !== undefined) update.priority     = priority;
    if (active       !== undefined) update.active       = active;
    if (order        !== undefined) update.order        = order;
    await q(db.tasks, 'update', { _id: req.params.id }, { $set: update }, {});
    const task = await q(db.tasks, 'findOne', { _id: req.params.id });
    res.json(task);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await q(db.tasks, 'update', { _id: req.params.id }, { $set: { active: false } }, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── ROUTES: CHECKS (état du jour) ────────────────────────────────────────────
app.get('/api/checks', async (req, res) => {
  try {
    const date = req.query.date || today();
    const checks = await q(db.checks, 'find', { date });
    res.json(checks);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/checks/toggle', async (req, res) => {
  try {
    const { taskId, userId, date: reqDate } = req.body;
    if (!taskId || !userId) return res.status(400).json({ error: 'taskId and userId required' });
    const date = reqDate || today();

    const existing = await q(db.checks, 'findOne', { taskId, date });
    let result;

    if (existing && existing.done) {
      // uncheck
      await q(db.checks, 'update', { taskId, date }, { $set: { done: false, userId: null, doneAt: null } }, { upsert: true });
      result = { done: false, userId: null };
      // log
      await q(db.history, 'insert', { _id: uuid(), taskId, userId, date, action: 'uncheck', createdAt: Date.now() });
    } else {
      // check
      await q(db.checks, 'update', { taskId, date }, { $set: { done: true, userId, doneAt: Date.now(), taskId, date } }, { upsert: true });
      result = { done: true, userId };
      // log
      await q(db.history, 'insert', { _id: uuid(), taskId, userId, date, action: 'check', createdAt: Date.now() });
    }
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/checks/reset', async (req, res) => {
  try {
    const { date: reqDate, userId } = req.body;
    const date = reqDate || today();
    await q(db.checks, 'remove', { date }, { multi: true });
    await q(db.history, 'insert', { _id: uuid(), taskId: 'ALL', userId: userId || 'system', date, action: 'reset', createdAt: Date.now() });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── ROUTES: HISTORY ──────────────────────────────────────────────────────────
app.get('/api/history', async (req, res) => {
  try {
    const { date, userId, limit: lim } = req.query;
    const filter = {};
    if (date)   filter.date   = date;
    if (userId) filter.userId = userId;
    let entries = await q(db.history, 'find', filter);
    entries.sort((a, b) => b.createdAt - a.createdAt);
    if (lim) entries = entries.slice(0, parseInt(lim));
    res.json(entries);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// List of all dates that have history
app.get('/api/history/dates', async (req, res) => {
  try {
    const all = await q(db.history, 'find', {});
    const dates = [...new Set(all.map(e => e.date))].sort().reverse();
    res.json(dates);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Stats per day
app.get('/api/history/stats', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const entries = await q(db.history, 'find', { date, action: { $in: ['check', 'uncheck'] } });
    const tasks   = await q(db.tasks, 'find', { active: true });
    const checks  = await q(db.checks, 'find', { date });
    const users   = await q(db.users, 'find', {});
    const userMap = Object.fromEntries(users.map(u => [u._id, u]));

    // Per user: how many tasks they checked
    const perUser = {};
    entries.filter(e => e.action === 'check').forEach(e => {
      if (!perUser[e.userId]) perUser[e.userId] = { count: 0, user: userMap[e.userId] };
      perUser[e.userId].count++;
    });

    // Final checked state
    const doneCount = checks.filter(c => c.done).length;

    res.json({ date, totalTasks: tasks.length, doneCount, perUser, entries: entries.slice(0, 100) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SECTIONS (derived from tasks) ───────────────────────────────────────────
app.get('/api/sections', async (req, res) => {
  try {
    const tasks = await q(db.tasks, 'find', { active: true });
    const sections = {};
    tasks.forEach(t => {
      if (!sections[t.section]) sections[t.section] = { name: t.section, order: t.sectionOrder };
    });
    const list = Object.values(sections).sort((a, b) => a.order - b.order);
    res.json(list);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── START ────────────────────────────────────────────────────────────────────
seed().then(() => {
  app.listen(PORT, () => console.log(`🚀 Pharmacie Mouysset running on http://localhost:${PORT}`));
});
