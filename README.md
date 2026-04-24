# 💊 Pharmacie Mouysset — Guide de Déploiement

## Architecture

```
pharmacie_mouysset/
├── server.js          ← API Express + base de données
├── package.json       ← Dépendances Node.js
├── data/              ← Base de données NeDB (auto-créé au démarrage)
│   ├── users.db
│   ├── tasks.db
│   ├── checks.db
│   └── history.db
└── public/
    └── index.html     ← Application frontend (SPA)
```

**Stack :** Node.js + Express + NeDB (SQLite-like, zéro config) + HTML/CSS/JS pur  
**Base de données :** Fichiers `.db` locaux, persistants, lisibles en JSON  
**Frontend :** Fichier HTML unique, polling toutes les 8 secondes pour la synchro temps réel  

---

## ⚡ Démarrage local (test)

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur
node server.js
# → http://localhost:3000

# Ou avec nodemon pour le développement (rechargement auto)
npm install -g nodemon
nodemon server.js
```

Le serveur seed automatiquement les 3 salariés et 19 tâches par défaut au premier démarrage.

---

## 🚀 Déploiement en production

### Option A — Railway.app (recommandé, gratuit)

1. Créer un compte sur **https://railway.app**
2. Nouveau projet → **"Deploy from GitHub"** (pousser le code sur GitHub d'abord)
   — OU — **"Deploy from local"** via CLI :
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```
3. Railway détecte automatiquement Node.js et lance `npm start`
4. URL publique générée : `https://pharmacie-mouysset.up.railway.app`

> ⚠️ **Important Railway :** Activer un volume persistant pour le dossier `data/`
> → Dans Railway : Service → Settings → Volumes → Mount path: `/app/data`

### Option B — Render.com (gratuit avec limitations)

1. Créer un compte sur **https://render.com**
2. New → **Web Service** → connecter le repo GitHub
3. Settings :
   - Build Command : `npm install`
   - Start Command : `node server.js`
   - Environment : Node
4. Ajouter un **Disk** (Render Dashboard → Disks) monté sur `/data`
5. Dans `server.js`, modifier le chemin des DB :
   ```javascript
   filename: '/data/users.db'  // au lieu de path.join(__dirname, 'data/users.db')
   ```

### Option C — VPS / Serveur dédié

```bash
# Sur le serveur
git clone <repo> pharmacie
cd pharmacie
npm install
npm install -g pm2

# Lancer avec PM2 (auto-restart, logs)
pm2 start server.js --name "pharmacie-mouysset"
pm2 startup     # démarrage automatique au boot
pm2 save

# Nginx reverse proxy (optionnel)
# → Pointer pharmacie.votredomaine.fr vers localhost:3000
```

---

## 🔌 Variables d'environnement

```env
PORT=3000           # Port d'écoute (défaut: 3000)
```

Ajouter dans Railway/Render dans la section **Environment Variables**.

---

## 🗄️ Base de données

Les données sont stockées dans des fichiers `.db` (format JSON ligne par ligne) dans `/data/`.

### Structure

**users.db** — Salariés
```json
{ "_id": "uuid", "name": "Mathieu", "role": "Référent – 6h30", "color": "#0077B6", "active": true, "isAdmin": true, "createdAt": 1714000000000 }
```

**tasks.db** — Tâches
```json
{ "_id": "uuid", "name": "Remplissage du robot", "section": "Matin", "sectionOrder": 1, "order": 1, "time": "6h30", "priority": 1, "active": true, "createdAt": 1714000000000 }
```

**checks.db** — État du jour (coches)
```json
{ "taskId": "uuid", "date": "2026-04-24", "done": true, "userId": "uuid", "doneAt": 1714050000000 }
```

**history.db** — Journal complet de toutes les actions
```json
{ "_id": "uuid", "taskId": "uuid", "userId": "uuid", "date": "2026-04-24", "action": "check", "createdAt": 1714050000000 }
```

### Sauvegarde

```bash
# Sauvegarder la base
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# Restaurer
tar -xzf backup-20260424.tar.gz
```

---

## 📡 API REST

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/users` | Liste des salariés actifs |
| POST | `/api/users` | Créer un salarié |
| PUT | `/api/users/:id` | Modifier un salarié |
| DELETE | `/api/users/:id` | Désactiver un salarié |
| GET | `/api/tasks` | Liste des tâches actives |
| POST | `/api/tasks` | Créer une tâche |
| PUT | `/api/tasks/:id` | Modifier une tâche |
| DELETE | `/api/tasks/:id` | Désactiver une tâche |
| GET | `/api/checks?date=` | État des coches pour une date |
| POST | `/api/checks/toggle` | Cocher / décocher une tâche |
| POST | `/api/checks/reset` | Remettre à zéro le jour |
| GET | `/api/history?date=&userId=` | Historique filtré |
| GET | `/api/history/dates` | Dates disponibles dans l'historique |
| GET | `/api/history/stats?date=` | Statistiques d'une journée |

---

## ✅ Fonctionnalités

- ✅ Synchronisation temps réel (polling 8s) — plusieurs appareils simultanés
- ✅ Historique complet par jour, par salarié, par action
- ✅ Ajout / modification / suppression de salariés depuis l'interface
- ✅ Ajout / modification / suppression de tâches depuis l'interface
- ✅ Traçabilité nominative : chaque coche enregistre qui + quand
- ✅ Nouveau jour : remet les coches à zéro sans effacer l'historique
- ✅ Filtres sur les tâches (toutes / à faire / faites)
- ✅ Vue manager avec progression par salarié
- ✅ Compatible mobile et desktop

---

## 💰 Coût estimé

| Hébergement | Plan       | Coût         |
|-------------|------------|--------------|
| Railway     | Hobby      | ~5 €/mois    |
| Render      | Free       | 0 € (sleep après 15min d'inactivité) |
| Render      | Starter    | ~7 €/mois (toujours actif) |
| VPS OVH     | VPS Starter| ~3.5 €/mois  |
