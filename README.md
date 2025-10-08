# Den 101 — Multimedia Tracker

Den 101 is a **local multimedia tracker** that lets you organize and keep track of your **games, anime, TV shows, movies, and books** — all in one place.
It runs entirely on your machine for privacy and flexibility.

---

## Tech Stack

* **Backend:** [Django](https://www.djangoproject.com/) + SQLite (local database)
* **Frontend:** [Electron](https://www.electronjs.org/), [Vite](https://vitejs.dev/), and [React](https://react.dev/)
* **Language:** Python + JavaScript/TypeScript
* **License:** [Den 101 Individual Use & Attribution License v1.0](./LICENSE)

---

## Features

* Track your **games, anime, TV shows, movies, and books**
* Local storage with **SQLite** — your data stays on your machine
* Integrated with popular content APIs:

  * Steam
  * AniList
  * The Movie Database (TMDB)
  * MyAnimeList (MAL)
* Modern interface powered by React + Vite
* Cross-platform desktop build via Electron

*(No remote server or online account required.)*

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/CPTicarus/Den_101.git
cd Den101
```

### 2. Backend setup (Django)

Make sure you have **Python 3.10+** installed.

```bash
pip install -r requirements.txt
python manage.py migrate
```

### 3. Frontend setup (Electron + React)

Make sure you have **Node.js 18+** and **npm** installed.

```bash
npm install
```

### 4. Environment variables

You’ll need to create your own API credentials.
At the project root, create a file named `.env` and include:

```
STEAM_API_KEY=your_steam_api_key
ANILIST_CLIENT_ID=your_anilist_client_id
ANILIST_CLIENT_SECRET=your_anilist_client_secret
TMDB_API_KEY=your_tmdb_api_key
MAL_CLIENT_ID=your_mal_client_id
```

*(These keys are required for data fetching and syncing with external APIs.)*

---

## Run the App

In one terminal (backend):

```bash
python manage.py runserver
```

In another terminal (frontend):

```bash
npm run dev
```

Electron will start and connect to the local Django server.
All data is stored in the local SQLite database (`db.sqlite3`).

---

## Build (optional)

To build the Electron app for distribution:

```bash
npm run build
```

The compiled desktop app will be available in your `dist/` folder (platform-specific).

---

## License

Den 101 is licensed under the **Den 101 Individual Use & Attribution License (D101-IUAL) v1.0**.

* **Individuals** may freely use, modify, distribute, and even sell this software or their modified versions, **as long as they credit the author** `CPTicarus`.
* **Organizations** may use or modify Den 101 **only for non-commercial purposes**.

See the [LICENSE](./LICENSE) file for full details.

---

## Author

**CPTicarus**
[GitHub Profile →](https://github.com/CPTicarus)

