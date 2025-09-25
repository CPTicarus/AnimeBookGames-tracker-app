# Anime, Book & Games Tracker App

A comprehensive media tracking application built with Django and React (Electron) that allows users to track their anime, manga, movies, TV shows, books, and games across multiple platforms.

## Features

### Media Integration
- **Steam Integration**: Track your game library and playtime
- **AniList Integration**: Sync anime and manga lists
- **MyAnimeList Integration**: Import and sync anime/manga progress
- **TMDB Integration**: Track movies and TV shows
- **Google Books Integration**: Track your reading progress

### Core Features
- Cross-platform desktop application (Windows, macOS, Linux)
- Real-time playtime tracking for Steam games
- Comprehensive statistics and progress tracking
- Dark/Light theme support
- Custom list creation and management
- Weighted scoring system based on time invested
- Library syncing across multiple services

## Technology Stack

### Backend
- **Framework**: Django/Django REST Framework
- **Database**: SQLite3
- **Authentication**: Token-based authentication with expiry
- **APIs Integrated**:
  - Steam Web API
  - AniList API
  - MyAnimeList API
  - TMDB API
  - Google Books API

### Frontend
- **Framework**: React with TypeScript
- **Desktop Framework**: Electron
- **UI Components**: Material-UI (MUI)
- **State Management**: React Context API
- **API Client**: Axios

## Setup Instructions

### Prerequisites
- Python 3.13+
- Node.js and npm
- API Keys for services (AniList, TMDB, etc.)

### Backend Setup
1. Clone the repository
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   Create a `.env` file in the project root with:
   ```
   STEAM_API_KEY=your_steam_api_key
   ANILIST_CLIENT_ID=your_anilist_client_id
   ANILIST_CLIENT_SECRET=your_anilist_client_secret
   TMDB_API_KEY=your_tmdb_api_key
   MAL_CLIENT_ID=your_mal_client_id
   ```
5. Run migrations:
   ```bash
   python manage.py migrate
   ```
6. Start the server:
   ```bash
   python manage.py runserver
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd my-anime-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Features in Detail

### Media Tracking
- Track progress across different media types
- Automatic playtime tracking for Steam games
- Manual progress tracking for other media types
- Status tracking (Planned, In Progress, Completed, Dropped, Paused)
- Score tracking with weighted averages

### Statistics
- Total time spent per media type
- Weighted average scores
- Completion rates
- Progress tracking
- Custom list statistics

### Synchronization
- Bidirectional sync with external services
- Option to keep local changes during sync
- Automatic playtime updates for games
- Bulk import from external services

### User Interface
- Responsive design
- Dark/Light theme support
- Custom list creation and management
- Advanced sorting and filtering
- Progress visualization
- Search across all media types

## Development

### Backend Structure
- Django REST Framework for API endpoints
- Token-based authentication
- Service-based architecture for external API integration
- Model-based data management
- Comprehensive test coverage

### Frontend Structure
- Electron for desktop integration
- React with TypeScript for UI
- Material-UI for components
- Service-based API integration
- Component-based architecture

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
