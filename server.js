const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { v4: uuid } = require('uuid');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db   = (text, params) => pool.query(text, params);

async function initDB() {
  await db(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT DEFAULT '',
    color TEXT DEFAULT '#607D8B', active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false, pin TEXT DEFAULT '1234', created_at BIGINT)`);

  await db(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, section TEXT NOT NULL,
    section_order INT DEFAULT 99, ord INT DEFAULT 1, time TEXT DEFAULT '',
    priority INT DEFAULT 2, days TEXT DEFAULT '[1,2,3,4,5,6]',
    active BOOLEAN DEFAULT true, created_at BIGINT)`);

  // Multi-check: one row per (task_id, user_id, date) — each user can check independently
  await db(`CREATE TABLE IF NOT EXISTS checks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    done BOOLEAN DEFAULT true,
    done_at BIGINT,
    UNIQUE(task_id, user_id, date)
  )`);

  await db(`CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY, task_id TEXT, user_id TEXT,
    date TEXT, action TEXT, created_at BIGINT)`);

  await db(`CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY, user_id TEXT, date TEXT,
    status TEXT DEFAULT 'present', updated_at BIGINT,
    UNIQUE(user_id, date))`);

  console.log('✅ Tables OK');
}

async function seed() {
  const { rows } = await db('SELECT COUNT(*) FROM users');
  if (parseInt(rows[0].count) === 0) {
    for (const u of [
      { name:'Mathieu',  role:'Référent – 6h30',   color:'#0077B6', admin:true  },
      { name:'Maryline', role:'Logistique – 7h30', color:'#2E7D32', admin:false },
      { name:'Marion',   role:'Logistique – 7h45', color:'#AD1457', admin:false },
    ]) await db('INSERT INTO users VALUES($1,$2,$3,$4,true,$5,$6,$7)',
      [uuid(), u.name, u.role, u.color, u.admin, '1234', Date.now()]);
    console.log('✅ Users seeded');
  }
  const { rows: tr } = await db('SELECT COUNT(*) FROM tasks');
  if (parseInt(tr[0].count) === 0) {
    const ALL='[1,2,3,4,5,6]', WD='[1,2,3,4,5]';
    for (const t of [
      ['Remplissage du robot',                              'Matin',          1,1,'6h30',        1,ALL],
      ['Réception commande OCP (fin avant 8h30)',           'Matin',          1,2,'7h00–8h30',   1,ALL],
      ['Rangement des pickings — 1ère vague',               'Matin',          1,3,'7h45–9h30',   1,ALL],
      ['Pilotage & dispatch dynamique',                     'Flux Principal', 2,1,'9h30',         1,ALL],
      ['Réception commandes grossistes',                    'Flux Principal', 2,2,'9h30–11h30',  1,ALL],
      ['Façing — Étiquettes électroniques',                 'Flux Principal', 2,3,'9h30–11h30',  2,ALL],
      ['Façing — Contrôle stocks & capacités rayon',        'Flux Principal', 2,4,'9h30–11h30',  2,ALL],
      ['Façing — Implantation produits / nouveautés',       'Flux Principal', 2,5,'9h30–11h30',  2,WD ],
      ['Façing — Gestion des anomalies & périmés',          'Flux Principal', 2,6,'9h30–11h30',  2,ALL],
      ['Façing — Suivi des ruptures',                       'Flux Principal', 2,7,'9h30–11h30',  2,ALL],
      ['Rangement des pickings — 2ème vague (avant 12h30)', '2ème Vague',     3,1,'11h30–12h30', 1,ALL],
      ['Réception commandes grossistes (après-midi)',        'Après-midi',     4,1,'Après-midi',  1,ALL],
      ['Réception commandes directes laboratoires',         'Après-midi',     4,2,'Après-midi',  1,WD ],
      ['Contrôle rigoureux BL directs labos',               'Après-midi',     4,3,'Après-midi',  1,WD ],
      ['Missions façings espace de vente',                  'Après-midi',     4,4,'Après-midi',  2,ALL],
      ['Gestion des litiges fournisseurs',                  'Selon Besoin',   5,1,'Selon besoin', 3,WD ],
      ['Paramétrage étiquettes électroniques',              'Selon Besoin',   5,2,'Selon besoin', 3,WD ],
      ['Contrôle des stocks & délottage',                   'Selon Besoin',   5,3,'Selon besoin', 3,WD ],
      ['Préparation des promis clients',                    'Selon Besoin',   5,4,'Selon besoin', 3,ALL],
    ]) await db('INSERT INTO tasks VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,$9)',
      [uuid(), t[0], t[1], t[2], t[3], t[4], t[5], t[6], Date.now()]);
    console.log('✅ Tasks seeded');
  }
}

function today() { return new Date().toISOString().slice(0,10); }
function safeUser(u) { return { _id:u.id, name:u.name, role:u.role, color:u.color, active:u.active, isAdmin:u.is_admin, hasPin:!!u.pin, createdAt:u.created_at }; }
function safeTask(t) { return { _id:t.id, name:t.name, section:t.section, sectionOrder:t.section_order, order:t.ord, time:t.time, priority:t.priority, days:JSON.parse(t.days||'[1,2,3,4,5,6]'), active:t.active, createdAt:t.created_at }; }

// ── USERS ─────────────────────────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await db('SELECT * FROM users WHERE active=true ORDER BY created_at');
    res.json(rows.map(safeUser));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/users', async (req, res) => {
  try {
    const { name, role, color, pin } = req.body;
    if (!name) return res.status(400).json({ error: 'Prénom requis' });
    const id = uuid();
    await db('INSERT INTO users VALUES($1,$2,$3,$4,true,false,$5,$6)', [id, name, role||'', color||'#607D8B', pin||'1234', Date.now()]);
    const { rows } = await db('SELECT * FROM users WHERE id=$1', [id]);
    res.json(safeUser(rows[0]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, role, color, active, isAdmin, pin } = req.body;
    if (name    !== undefined) await db('UPDATE users SET name=$1     WHERE id=$2', [name,    req.params.id]);
    if (role    !== undefined) await db('UPDATE users SET role=$1     WHERE id=$2', [role,    req.params.id]);
    if (color   !== undefined) await db('UPDATE users SET color=$1    WHERE id=$2', [color,   req.params.id]);
    if (active  !== undefined) await db('UPDATE users SET active=$1   WHERE id=$2', [active,  req.params.id]);
    if (isAdmin !== undefined) await db('UPDATE users SET is_admin=$1 WHERE id=$2', [isAdmin, req.params.id]);
    if (pin && pin !== '') await db('UPDATE users SET pin=$1 WHERE id=$2', [pin, req.params.id]);
    const { rows } = await db('SELECT * FROM users WHERE id=$1', [req.params.id]);
    res.json(safeUser(rows[0]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/users/:id', async (req, res) => {
  try {
    await db('UPDATE users SET active=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/users/verify-pin', async (req, res) => {
  try {
    const { userId, pin } = req.body;
    const { rows } = await db('SELECT * FROM users WHERE id=$1 AND active=true', [userId]);
    if (!rows.length) return res.json({ ok: false, error: 'Utilisateur introuvable' });
    if (!rows[0].pin || rows[0].pin === pin) return res.json({ ok: true });
    res.json({ ok: false, error: 'Code PIN incorrect ❌' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ATTENDANCE ────────────────────────────────────────────────────────────────
app.get('/api/attendance', async (req, res) => {
  try {
    const { rows } = await db('SELECT * FROM attendance WHERE date=$1', [req.query.date || today()]);
    res.json(rows.map(r => ({ userId: r.user_id, date: r.date, status: r.status })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/attendance/range', async (req, res) => {
  try {
    const { rows } = await db('SELECT * FROM attendance WHERE date>=$1 AND date<=$2', [req.query.from, req.query.to]);
    res.json(rows.map(r => ({ userId: r.user_id, date: r.date, status: r.status })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/attendance', async (req, res) => {
  try {
    const { userId, date: d, status } = req.body;
    const date = d || today();
    await db(`INSERT INTO attendance VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,date) DO UPDATE SET status=$4, updated_at=$5`,
      [uuid(), userId, date, status, Date.now()]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── TASKS ─────────────────────────────────────────────────────────────────────
app.get('/api/tasks', async (req, res) => {
  try {
    const { rows } = await db('SELECT * FROM tasks WHERE active=true ORDER BY section_order, ord');
    res.json(rows.map(safeTask));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/tasks', async (req, res) => {
  try {
    const { name, section, sectionOrder, time, priority, days } = req.body;
    if (!name || !section) return res.status(400).json({ error: 'name et section requis' });
    const { rows: ex } = await db('SELECT MAX(ord) as mo FROM tasks WHERE section=$1 AND active=true', [section]);
    const id = uuid();
    await db('INSERT INTO tasks VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,$9)',
      [id, name, section, sectionOrder||99, (ex[0].mo||0)+1, time||'', priority||2, JSON.stringify(days||[1,2,3,4,5,6]), Date.now()]);
    const { rows } = await db('SELECT * FROM tasks WHERE id=$1', [id]);
    res.json(safeTask(rows[0]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { name, section, sectionOrder, time, priority, active, order, days } = req.body;
    if (name         !== undefined) await db('UPDATE tasks SET name=$1          WHERE id=$2', [name,                 req.params.id]);
    if (section      !== undefined) await db('UPDATE tasks SET section=$1       WHERE id=$2', [section,              req.params.id]);
    if (sectionOrder !== undefined) await db('UPDATE tasks SET section_order=$1 WHERE id=$2', [sectionOrder,         req.params.id]);
    if (time         !== undefined) await db('UPDATE tasks SET time=$1          WHERE id=$2', [time,                 req.params.id]);
    if (priority     !== undefined) await db('UPDATE tasks SET priority=$1      WHERE id=$2', [priority,             req.params.id]);
    if (active       !== undefined) await db('UPDATE tasks SET active=$1        WHERE id=$2', [active,               req.params.id]);
    if (order        !== undefined) await db('UPDATE tasks SET ord=$1           WHERE id=$2', [order,                req.params.id]);
    if (days         !== undefined) await db('UPDATE tasks SET days=$1          WHERE id=$2', [JSON.stringify(days), req.params.id]);
    const { rows } = await db('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    res.json(safeTask(rows[0]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await db('UPDATE tasks SET active=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── CHECKS (multi-user per task) ──────────────────────────────────────────────
// Returns: [ { taskId, userId, date, done, doneAt } ]
app.get('/api/checks', async (req, res) => {
  try {
    const { rows } = await db('SELECT * FROM checks WHERE date=$1 AND done=true', [req.query.date || today()]);
    res.json(rows.map(r => ({ taskId: r.task_id, userId: r.user_id, date: r.date, done: r.done, doneAt: r.done_at })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/checks/toggle', async (req, res) => {
  try {
    const { taskId, userId, pin, date: d } = req.body;
    if (!taskId || !userId) return res.status(400).json({ error: 'taskId et userId requis' });
    // Verify PIN
    const { rows: ur } = await db('SELECT * FROM users WHERE id=$1 AND active=true', [userId]);
    if (!ur.length) return res.status(403).json({ ok: false, error: 'Utilisateur introuvable' });
    if (ur[0].pin && ur[0].pin !== pin) return res.status(403).json({ ok: false, error: 'Code PIN incorrect ❌' });
    const date = d || today();
    // Check if THIS user already checked THIS task today
    const { rows: cr } = await db('SELECT * FROM checks WHERE task_id=$1 AND user_id=$2 AND date=$3', [taskId, userId, date]);
    let result;
    if (cr.length && cr[0].done) {
      // Uncheck for this user
      await db('UPDATE checks SET done=false WHERE task_id=$1 AND user_id=$2 AND date=$3', [taskId, userId, date]);
      result = { done: false, userId };
      await db('INSERT INTO history VALUES($1,$2,$3,$4,$5,$6)', [uuid(), taskId, userId, date, 'uncheck', Date.now()]);
    } else {
      // Check for this user
      await db(`INSERT INTO checks VALUES($1,$2,$3,$4,true,$5)
        ON CONFLICT(task_id,user_id,date) DO UPDATE SET done=true, done_at=$5`,
        [uuid(), taskId, userId, date, Date.now()]);
      result = { done: true, userId };
      await db('INSERT INTO history VALUES($1,$2,$3,$4,$5,$6)', [uuid(), taskId, userId, date, 'check', Date.now()]);
    }
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/checks/reset', async (req, res) => {
  try {
    const { date: d, userId, pin } = req.body;
    if (userId) {
      const { rows } = await db('SELECT * FROM users WHERE id=$1 AND active=true', [userId]);
      if (rows.length && rows[0].pin && rows[0].pin !== pin)
        return res.status(403).json({ ok: false, error: 'Code PIN incorrect ❌' });
    }
    const date = d || today();
    await db('DELETE FROM checks WHERE date=$1', [date]);
    await db('INSERT INTO history VALUES($1,$2,$3,$4,$5,$6)', [uuid(), 'ALL', userId||'system', date, 'reset', Date.now()]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── HISTORY ───────────────────────────────────────────────────────────────────
app.get('/api/history', async (req, res) => {
  try {
    const { date, userId, limit: lim } = req.query;
    let q = 'SELECT * FROM history WHERE 1=1'; const params = [];
    if (date)   { params.push(date);   q += ` AND date=$${params.length}`; }
    if (userId) { params.push(userId); q += ` AND user_id=$${params.length}`; }
    q += ' ORDER BY created_at DESC';
    if (lim)    { params.push(parseInt(lim)); q += ` LIMIT $${params.length}`; }
    const { rows } = await db(q, params);
    res.json(rows.map(r => ({ _id:r.id, taskId:r.task_id, userId:r.user_id, date:r.date, action:r.action, createdAt:r.created_at })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/history/dates', async (req, res) => {
  try {
    const { rows } = await db('SELECT DISTINCT date FROM history ORDER BY date DESC');
    res.json(rows.map(r => r.date));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── RAPPORT ───────────────────────────────────────────────────────────────────
app.get('/api/report', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from et to requis' });
    const { rows: users }   = await db('SELECT * FROM users');
    const { rows: tasks }   = await db('SELECT * FROM tasks WHERE active=true');
    const { rows: checks }  = await db('SELECT * FROM checks WHERE date>=$1 AND date<=$2 AND done=true', [from, to]);
    const { rows: attends } = await db('SELECT * FROM attendance WHERE date>=$1 AND date<=$2', [from, to]);
    const dates = [];
    let cur = new Date(from+'T12:00:00'), end = new Date(to+'T12:00:00');
    while (cur<=end) { dates.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1); }
    const attendMap = {};
    attends.forEach(a => { attendMap[`${a.user_id}_${a.date}`] = a.status; });
    const report = users.filter(u=>u.active).map(u => {
      const presentDays = dates.filter(d => { const s=attendMap[`${u.id}_${d}`]; return !s||s==='present'; });
      const absentDays  = dates.filter(d => attendMap[`${u.id}_${d}`]==='absent');
      const offDays     = dates.filter(d => attendMap[`${u.id}_${d}`]==='off');
      const myChecks    = checks.filter(c => c.user_id===u.id);
      let expectedTotal = 0;
      presentDays.forEach(d => {
        const dow = new Date(d+'T12:00:00').getDay();
        expectedTotal += tasks.filter(t => JSON.parse(t.days||'[1,2,3,4,5,6]').includes(dow)).length;
      });
      const doneTotal    = myChecks.length;
      const productivity = expectedTotal>0 ? Math.round(doneTotal/expectedTotal*100) : null;
      const byDay = dates.map(d => {
        const dow    = new Date(d+'T12:00:00').getDay();
        const status = attendMap[`${u.id}_${d}`]||'present';
        const exp    = status==='present' ? tasks.filter(t=>JSON.parse(t.days||'[1,2,3,4,5,6]').includes(dow)).length : 0;
        const done   = checks.filter(c=>c.user_id===u.id&&c.date===d).length;
        return { date:d, status, done, expected:exp, pct: exp>0?Math.round(done/exp*100):null };
      });
      return { user:safeUser(u), presentDays:presentDays.length, absentDays:absentDays.length, offDays:offDays.length, totalDays:dates.length, expectedTotal, doneTotal, productivity, byDay };
    });
    res.json({ from, to, totalDays:dates.length, report });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

initDB().then(seed).then(() => app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`))).catch(e => { console.error('❌', e.message); process.exit(1); });
