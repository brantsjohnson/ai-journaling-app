# AI Journaling App 📝🎙️

An intelligent journaling application with voice recording, AI-powered transcription, and cloud storage capabilities.

## Features

- 🎙️ **Voice Recording**: Record journal entries with audio
- 🤖 **AI Transcription**: Automatic transcription using OpenAI Whisper
- ☁️ **Cloud Storage**: Supabase for database and audio file storage
- 🔐 **Authentication**: Secure JWT-based auth with bcrypt password hashing
- 📱 **Responsive Design**: Works on desktop and mobile
- 🎨 **Modern UI**: Built with React and Tailwind CSS
- 🔄 **Real-time Sync**: Optional Google Drive sync

## Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- React Router
- Framer Motion
- Supabase Client

### Backend
- Node.js & Express
- Supabase (PostgreSQL)
- JWT Authentication
- OpenAI API
- Multer for file uploads

### Database & Storage
- Supabase PostgreSQL
- Supabase Storage (Audio files)

## Project Structure

```
ai-journaling-app/
├── frontend/          # React frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/           # Express API
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── supabase/
│   └── server.js
├── vercel.json        # Vercel deployment config
├── DEPLOYMENT.md      # Deployment guide
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- Supabase account
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ibrahimm7004/ai-journaling-app.git
   cd Journling-App
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

   Create `.env` file (copy from `.env.example`):
   ```env
   NODE_ENV=development
   PORT=4000
   JWT_SECRET=your_secret_key
   OPEN_AI_KEY=your_openai_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_AUDIO_BUCKET=audio
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

   Create `.env` file if needed (for Vite env vars)

4. **Database Setup**

   In your Supabase SQL Editor, run:
   ```sql
   -- Run backend/supabase/schema.sql
   -- Then run backend/supabase/exec_sql_function.sql
   ```

   See `backend/SETUP.md` for detailed instructions.

### Running Locally

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete Vercel deployment instructions.

### Quick Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zunnoonwaheed/Journling-App)

## API Endpoints

### Authentication
- `POST /api/journal-ease/auth/signup` - Create account
- `POST /api/journal-ease/auth/login` - Login
- `POST /api/journal-ease/auth/forgot-password` - Password reset request
- `POST /api/journal-ease/auth/reset-password` - Reset password

### Entries
- `GET /api/journal-ease/entries/:userId` - Get all entries
- `GET /api/journal-ease/entries/:userId/:entryId` - Get specific entry
- `POST /api/journal-ease/entries/:userId` - Create entry
- `PATCH /api/journal-ease/entries/:userId/:entryId` - Update entry
- `DELETE /api/journal-ease/entries/:userId/:entryId` - Delete entry

### Transcription
- `POST /api/journal-ease/transcribe` - Transcribe audio file

## Database Schema

### Users
- id, email, name, password_hash
- reset_token, reset_token_expires
- created_at

### Entries
- id, user_id, transcript
- created_at, updated_at, duration_ms
- local_path, transcript_id, journal_date
- drive_sync_enabled, sync_status

### Transcripts
- id, recording_id, text
- language, confidence
- created_at

## Environment Variables

### Backend
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 4000)
- `JWT_SECRET` - Secret for JWT tokens
- `OPEN_AI_KEY` - OpenAI API key for transcription
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_AUDIO_BUCKET` - Storage bucket name

### Frontend
- `VITE_API_URL` - Backend API URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

## Features in Detail

### Voice Recording
- Record audio directly in the browser
- Convert to MP3 format
- Upload to Supabase Storage

### AI Transcription
- Powered by OpenAI Whisper API
- Automatic transcription of recordings
- Support for multiple languages

### Journal Management
- Create, read, update, delete entries
- Date-based organization
- Search and filter capabilities

### Authentication & Security
- JWT token-based authentication
- Bcrypt password hashing
- Protected API routes
- Secure password reset flow

## Troubleshooting

### Backend won't connect to database
- Check that `exec_sql` function is created in Supabase
- Verify environment variables are correct
- See `backend/SETUP.md` for detailed instructions

### Frontend can't reach backend
- Ensure backend is running on port 4000
- Check CORS configuration in `backend/app.js`
- Update allowed origins if needed

### Audio upload fails
- Verify Supabase storage bucket exists
- Check bucket permissions (public or authenticated)
- Ensure SUPABASE_AUDIO_BUCKET env var is set

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - feel free to use this project for learning or commercial purposes

## Support

For issues or questions:
- Open an issue on GitHub
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment help
- Check [backend/SETUP.md](./backend/SETUP.md) for backend setup

## Acknowledgments

- OpenAI for Whisper API
- Supabase for backend infrastructure
- Vercel for hosting

---
