const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const { v4: uuid } = require('uuid');
const Datastore = require('@seald-io/nedb');

const app  = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── BASES DE DONNÉES ─────────────────────────────────────────────────────────
const db = {
  users:      new Datastore({ filename: path.join(__dirname, 'data/users.db'),      autoload: true }),
  tasks:      new Datastore({ filename: path.join(__dirname, 'data/tasks.db'),      autoload: true }),
  checks:     new Datastore({ filename: path.join(__dirname, 'data/checks.db'),     autoload: true }),
  history:    new Datastore({ filename: path.join(__dirname, 'data/history.db'),    autoload: true }),
  attendance: new Datastore({ filename: path.join(__dirname, 'data/attendance.db'), autoload: true }),
};
db.checks.ensureIndex({ fieldName: 'date' });
db.history.ensureIndex({ fieldName: 'date' });
db.attendance.ensureIndex({ fieldName: 'date' });

const q = (store, method, ...args) => new Promise((res, rej) =>
  store[method](...args, (err, r) => err ? rej(err) : res(r))
);

function today() { return new Date().toISOString().slice(0, 10); }
function safeUser(u) { return { ...u, pin: undefined, hasPin: !!u.pin }; }

// ── SEED ─────────────────────────────────────────────────────────────────────
async function seed() {
  if (await q(db.users, 'count', {}) === 0) {
    for (const u of [
      { _id: uuid(), name: 'Mathieu',  role: 'Référent – 6h30',   color: '#0077B6', active: true, isAdmin: true,  pin: '1234', createdAt: Date.now() },
      { _id: uuid(), name: 'Maryline', role: 'Logistique – 7h30', color: '#2E7D32', active: true, isAdmin: false, pin: '1234', createdAt: Date.now() },
      { _id: uuid(), name: 'Marion',   role: 'Logistique – 7h45', color: '#AD1457', active: true, isAdmin: false, pin: '1234', createdAt: Date.now() },
    ]) await q(db.users, 'insert', u);
    console.log('✅ Users seeded');
  }
  // migration: ajouter pin manquant
  for (const u of await q(db.users, 'find', { pin: { $exists: false } }))
    await q(db.users, 'update', { _id: u._id }, { $set: { pin: '1234' } }, {});

  if (await q(db.tasks, 'count', {}) === 0) {
    const ALL = [1,2,3,4,5,6], WD = [1,2,3,4,5];
    for (const t of [
      { _id:uuid(), name:'Remplissage du robot',                               section:'Matin',          sO:1, o:1,  time:'6h30',        prio:1, days:ALL },
      { _id:uuid(), name:'Réception commande OCP (fin avant 8h30)',            section:'Matin',          sO:1, o:2,  time:'7h00–8h30',   prio:1, days:ALL },
      { _id:uuid(), name:'Rangement des pickings — 1ère vague',                section:'Matin',          sO:1, o:3,  time:'7h45–9h30',   prio:1, days:ALL },
      { _id:uuid(), name:'Pilotage & dispatch dynamique',                      section:'Flux Principal', sO:2, o:1,  time:'9h30',         prio:1, days:ALL },
      { _id:uuid(), name:'Réception commandes grossistes',                     section:'Flux Principal', sO:2, o:2,  time:'9h30–11h30',  prio:1, days:ALL },
      { _id:uuid(), name:'Façing — Étiquettes électroniques',                  section:'Flux Principal', sO:2, o:3,  time:'9h30–11h30',  prio:2, days:ALL },
      { _id:uuid(), name:'Façing — Contrôle stocks & capacités rayon',         section:'Flux Principal', sO:2, o:4,  time:'9h30–11h30',  prio:2, days:ALL },
      { _id:uuid(), name:'Façing — Implantation produits / nouveautés',        section:'Flux Principal', sO:2, o:5,  time:'9h30–11h30',  prio:2, days:WD  },
      { _id:uuid(), name:'Façing — Gestion des anomalies & périmés',           section:'Flux Principal', sO:2, o:6,  time:'9h30–11h30',  prio:2, days:ALL },
      { _id:uuid(), name:'Façing — Suivi des ruptures',                        section:'Flux Principal', sO:2, o:7,  time:'9h30–11h30',  prio:2, days:ALL },
      { _id:uuid(), name:'Rangement des pickings — 2ème vague (avant 12h30)',  section:'2ème Vague',     sO:3, o:1,  time:'11h30–12h30', prio:1, days:ALL },
      { _id:uuid(), name:'Réception commandes grossistes (après-midi)',         section:'Après-midi',     sO:4, o:1,  time:'Après-midi',  prio:1, days:ALL },
      { _id:uuid(), name:'Réception commandes directes laboratoires',          section:'Après-midi',     sO:4, o:2,  time:'Après-midi',  prio:1, days:WD  },
      { _id:uuid(), name:'Contrôle rigoureux BL directs labos',                section:'Après-midi',     sO:4, o:3,  time:'Après-midi',  prio:1, days:WD  },
      { _id:uuid(), name:'Missions façings espace de vente',                   section:'Après-midi',     sO:4, o:4,  time:'Après-midi',  prio:2, days:ALL },
      { _id:uuid(), name:'Gestion des litiges fournisseurs',                   section:'Selon Besoin',   sO:5, o:1,  time:'Selon besoin', prio:3, days:WD  },
      { _id:uuid(), name:'Paramétrage étiquettes électroniques',               section:'Selon Besoin',   sO:5, o:2,  time:'Selon besoin', prio:3, days:WD  },
      { _id:uuid(), name:'Contrôle des stocks & délottage',                    section:'Selon Besoin',   sO:5, o:3,  time:'Selon besoin', prio:3, days:WD  },
      { _id:uuid(), name:'Préparation des promis clients',                     section:'Selon Besoin',   sO:5, o:4,  time:'Selon besoin', prio:3, days:ALL },
    ]) await q(db.tasks, 'insert', { ...t, sectionOrder: t.sO, order: t.o, priority: t.prio, active: true, createdAt: Date.now() });
    console.log('✅ Tasks seeded');
  }
  // migration: ajouter days manquant
  for (const t of await q(db.tasks, 'find', { days: { $exists: false } }))
    await q(db.tasks, 'update', { _id: t._id }, { $set: { days: [1,2,3,4,5,6] } }, {});
}

// ── USERS ─────────────────────────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    const users = await q(db.users, 'find', { active: true });
    users.sort((a, b) => a.createdAt - b.createdAt);
    res.json(users.map(safeUser));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, role, color, pin } = req.body;
    if (!name) return res.status(400).json({ error: 'Prénom requis' });
    const u = { _id: uuid(), name, role: role||'', color: color||'#607D8B', active: true, isAdmin: false, pin: pin||'1234', createdAt: Date.now() };
    await q(db.users, 'insert', u);
    res.json(safeUser(u));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, role, color, active, isAdmin, pin } = req.body;
    const upd = {};
    if (name    !== undefined) upd.name    = name;
    if (role    !== undefined) upd.role    = role;
    if (color   !== undefined) upd.color   = color;
    if (active  !== undefined) upd.active  = active;
    if (isAdmin !== undefined) upd.isAdmin = isAdmin;
    if (pin && pin !== '') upd.pin = pin;
    await q(db.users, 'update', { _id: req.params.id }, { $set: upd }, {});
    const u = await q(db.users, 'findOne', { _id: req.params.id });
    res.json(safeUser(u));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await q(db.users, 'update', { _id: req.params.id }, { $set: { active: false } }, {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/verify-pin', async (req, res) => {
  try {
    const { userId, pin } = req.body;
    const u = await q(db.users, 'findOne', { _id: userId, active: true });
    if (!u) return res.json({ ok: false, error: 'Utilisateur introuvable' });
    if (!u.pin || u.pin === pin) return res.json({ ok: true });
    res.json({ ok: false, error: 'Code PIN incorrect ❌' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ATTENDANCE ────────────────────────────────────────────────────────────────
// attendance: { _id, userId, date, status: 'present'|'absent'|'off' }
app.get('/api/attendance', async (req, res) => {
  try {
    const date = req.query.date || today();
    res.json(await q(db.attendance, 'find', { date }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/attendance/range', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to)   filter.date.$lte = to;
    }
    res.json(await q(db.attendance, 'find', filter));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { userId, date: d, status } = req.body;
    const date = d || today();
    await q(db.attendance, 'update', { userId, date }, { $set: { userId, date, status, updatedAt: Date.now() } }, { upsert: true });
    res.json({ ok: true, userId, date, status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TASKS ─────────────────────────────────────────────────────────────────────
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await q(db.tasks, 'find', { active: true });
    tasks.sort((a, b) => a.sectionOrder - b.sectionOrder || a.order - b.order);
    res.json(tasks);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { name, section, sectionOrder, time, priority, days } = req.body;
    if (!name || !section) return res.status(400).json({ error: 'name et section requis' });
    const existing = await q(db.tasks, 'find', { section, active: true });
    const maxOrder = existing.reduce((m, t) => Math.max(m, t.order || 0), 0);
    const t = { _id: uuid(), name, section, sectionOrder: sectionOrder||99, order: maxOrder+1, time: time||'', priority: priority||2, days: days||[1,2,3,4,5,6], active: true, createdAt: Date.now() };
    await q(db.tasks, 'insert', t);
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { name, section, sectionOrder, time, priority, active, order, days } = req.body;
    const upd = {};
    if (name         !== undefined) upd.name         = name;
    if (section      !== undefined) upd.section      = section;
    if (sectionOrder !== undefined) upd.sectionOrder = sectionOrder;
    if (time         !== undefined) upd.time         = time;
    if (priority     !== undefined) upd.priority     = priority;
    if (active       !== undefined) upd.active       = active;
    if (order        !== undefined) upd.order        = order;
    if (days         !== undefined) upd.days         = days;
    await q(db.tasks, 'update', { _id: req.params.id }, { $set: upd }, {});
    res.json(await q(db.tasks, 'findOne', { _id: req.params.id }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await q(db.tasks, 'update', { _id: req.params.id }, { $set: { active: false } }, {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CHECKS ────────────────────────────────────────────────────────────────────
app.get('/api/checks', async (req, res) => {
  try {
    res.json(await q(db.checks, 'find', { date: req.query.date || today() }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/checks/toggle', async (req, res) => {
  try {
    const { taskId, userId, pin, date: d } = req.body;
    if (!taskId || !userId) return res.status(400).json({ error: 'taskId et userId requis' });
    const u = await q(db.users, 'findOne', { _id: userId, active: true });
    if (!u) return res.status(403).json({ ok: false, error: 'Utilisateur introuvable' });
    if (u.pin && u.pin !== pin) return res.status(403).json({ ok: false, error: 'Code PIN incorrect ❌' });
    const date = d || today();
    const existing = await q(db.checks, 'findOne', { taskId, date });
    let result;
    if (existing && existing.done) {
      await q(db.checks, 'update', { taskId, date }, { $set: { done: false, userId: null, doneAt: null } }, { upsert: true });
      result = { done: false, userId: null };
      await q(db.history, 'insert', { _id: uuid(), taskId, userId, date, action: 'uncheck', createdAt: Date.now() });
    } else {
      await q(db.checks, 'update', { taskId, date }, { $set: { done: true, userId, doneAt: Date.now(), taskId, date } }, { upsert: true });
      result = { done: true, userId };
      await q(db.history, 'insert', { _id: uuid(), taskId, userId, date, action: 'check', createdAt: Date.now() });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/checks/reset', async (req, res) => {
  try {
    const { date: d, userId, pin } = req.body;
    if (userId) {
      const u = await q(db.users, 'findOne', { _id: userId, active: true });
      if (u && u.pin && u.pin !== pin) return res.status(403).json({ ok: false, error: 'Code PIN incorrect ❌' });
    }
    const date = d || today();
    await q(db.checks, 'remove', { date }, { multi: true });
    await q(db.history, 'insert', { _id: uuid(), taskId: 'ALL', userId: userId||'system', date, action: 'reset', createdAt: Date.now() });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── HISTORY ───────────────────────────────────────────────────────────────────
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/history/dates', async (req, res) => {
  try {
    const all = await q(db.history, 'find', {});
    res.json([...new Set(all.map(e => e.date))].sort().reverse());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── RAPPORT RENTABILITÉ ───────────────────────────────────────────────────────
app.get('/api/report', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from et to requis (YYYY-MM-DD)' });

    const users    = await q(db.users, 'find', {});
    const tasks    = await q(db.tasks, 'find', { active: true });
    const checks   = await q(db.checks, 'find', { date: { $gte: from, $lte: to }, done: true });
    const attends  = await q(db.attendance, 'find', { date: { $gte: from, $lte: to } });

    // Build date range
    const dates = [];
    let cur = new Date(from + 'T12:00:00');
    const end = new Date(to   + 'T12:00:00');
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    const userMap  = Object.fromEntries(users.map(u => [u._id, u]));
    const attendMap = {};
    attends.forEach(a => { attendMap[`${a.userId}_${a.date}`] = a.status; });

    const report = users.filter(u => u.active).map(u => {
      // days present
      const presentDays = dates.filter(d => {
        const status = attendMap[`${u._id}_${d}`];
        return !status || status === 'present'; // default = present if not set
      });
      const absentDays  = dates.filter(d => attendMap[`${u._id}_${d}`] === 'absent');
      const offDays     = dates.filter(d => attendMap[`${u._id}_${d}`] === 'off');

      // tasks done per day
      const myChecks = checks.filter(c => c.userId === u._id);

      // expected tasks per present day
      let expectedTotal = 0;
      presentDays.forEach(d => {
        const dow = new Date(d + 'T12:00:00').getDay();
        const dayTasks = tasks.filter(t => (t.days || [1,2,3,4,5,6]).includes(dow));
        expectedTotal += dayTasks.length;
      });

      const doneTotal = myChecks.length;
      const productivity = expectedTotal > 0 ? Math.round(doneTotal / expectedTotal * 100) : null;

      // per-day breakdown
      const byDay = dates.map(d => {
        const dow    = new Date(d + 'T12:00:00').getDay();
        const status = attendMap[`${u._id}_${d}`] || 'present';
        const dayTasks = tasks.filter(t => (t.days||[1,2,3,4,5,6]).includes(dow));
        const done  = checks.filter(c => c.userId === u._id && c.date === d).length;
        const exp   = status === 'present' ? dayTasks.length : 0;
        return { date: d, status, done, expected: exp, pct: exp > 0 ? Math.round(done/exp*100) : null };
      });

      return {
        user: safeUser(u),
        presentDays: presentDays.length,
        absentDays: absentDays.length,
        offDays: offDays.length,
        totalDays: dates.length,
        expectedTotal,
        doneTotal,
        productivity,
        byDay,
      };
    });

    res.json({ from, to, totalDays: dates.length, report });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── START ─────────────────────────────────────────────────────────────────────
seed().then(() => app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`)));
