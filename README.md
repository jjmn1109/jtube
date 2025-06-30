# JTube - YouTube-like Video Sharing Platform

A modern video sharing platform built with React (TypeScript) frontend and Node.js/Express backend.

## Features

- 📹 Video upload with multiple format support (MP4, MOV, AVI, MKV, WebM)
- 🖼️ Automatic thumbnail generation from videos
- 📱 Responsive design that works on all devices
- 🎥 Video streaming with HTML5 player
- 📊 View counter for videos
- 🗂️ Clean grid layout for video browsing
- ⬆️ Drag & drop file upload interface

## Tech Stack

### Frontend
- React 19 with TypeScript
- React Router for navigation
- Axios for API calls
- CSS3 with responsive design

### Backend
- Node.js with Express
- Multer for file uploads
- FFmpeg for thumbnail generation
- UUID for unique identifiers

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone and navigate to the project**
   ```bash
   cd jtube
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Start the development servers**
   
   Option 1: Run both servers simultaneously
   ```bash
   npm run dev
   ```
   
   Option 2: Run servers separately
   ```bash
   # Terminal 1 - Backend
   npm run server
   
   # Terminal 2 - Frontend
   npm run client
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Project Structure

```
jtube/
├── client/                    # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Header.tsx
│   │   │   ├── VideoList.tsx
│   │   │   ├── VideoPlayer.tsx
│   │   │   └── UploadVideo.tsx
│   │   ├── services/         # API services
│   │   │   └── videoService.ts
│   │   ├── types.ts          # TypeScript types
│   │   ├── App.tsx           # Main App component
│   │   └── index.tsx         # Entry point
│   └── package.json
├── server/
│   └── server.js             # Express backend
├── uploads/
│   ├── videos/               # Uploaded video files
│   └── thumbnails/           # Generated thumbnails
└── package.json              # Root package.json
```

## API Endpoints

- `GET /api/videos` - Get all videos
- `GET /api/videos/:id` - Get specific video (increments view count)
- `POST /api/upload` - Upload new video
- `DELETE /api/videos/:id` - Delete video
- `GET /api/health` - Health check

## Upload Specifications

- **Supported formats**: MP4, MOV, AVI, MKV, WebM
- **Maximum file size**: 1GB
- **Thumbnail generation**: Automatic (captured at 2 seconds)
- **Thumbnail size**: 320x240 pixels

## Features in Detail

### Video Upload
- Drag & drop interface
- File validation (type and size)
- Progress indication
- Automatic thumbnail generation
- Form validation for title and description

### Video Display
- Grid layout with responsive design
- Thumbnail previews
- Video metadata (title, views, upload date)
- Truncated descriptions with full text on hover

### Video Player
- HTML5 video player with controls
- Full metadata display
- View counter increment
- Responsive video sizing

## Development Scripts

- `npm run dev` - Start both frontend and backend
- `npm run server` - Start backend only
- `npm run client` - Start frontend only
- `npm run build` - Build frontend for production
- `npm run install-all` - Install all dependencies

## Environment Variables

Create a `.env` file in the root directory:

```
PORT=5000
REACT_APP_API_URL=http://localhost:5000/api
```

## Notes

- Videos are stored locally in the `uploads/videos` directory
- Thumbnails are generated and stored in `uploads/thumbnails`
- Video metadata is stored in memory (consider using a database for production)
- FFmpeg is used for thumbnail generation (included via ffmpeg-static)

## Production Deployment

For production deployment:

1. Build the frontend: `npm run build`
2. Serve the built files from the backend
3. Use a proper database instead of in-memory storage
4. Implement user authentication
5. Add video compression and multiple quality options
6. Set up cloud storage for scalability

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project as a starting point for your own video sharing platform!
