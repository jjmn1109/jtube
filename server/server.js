const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const subtitleUtils = require('./subtitleUtils');

// Set the path to ffmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

// Set explicit FFmpeg paths for Windows installation
const os = require('os');
const ffmpegBinPath = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-7.1.1-full_build', 'bin');

// Check if winget FFmpeg installation exists, otherwise use ffmpeg-static
if (require('fs').existsSync(path.join(ffmpegBinPath, 'ffmpeg.exe'))) {
  ffmpeg.setFfmpegPath(path.join(ffmpegBinPath, 'ffmpeg.exe'));
  ffmpeg.setFfprobePath(path.join(ffmpegBinPath, 'ffprobe.exe'));
  console.log('Using system FFmpeg installation:', ffmpegBinPath);
} else {
  console.log('Using bundled FFmpeg from ffmpeg-static');
}

// Configure upload directories
const UPLOADS_BASE_DIR = 'Z:\\Video\\Animation\\드래곤볼_Kai';
const VIDEOS_DIR = UPLOADS_BASE_DIR;
const THUMBNAILS_DIR = path.join(UPLOADS_BASE_DIR, 'thumbnails');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Pre-defined users with hashed passwords
const users = [
  {
    id: 'admin',
    username: 'admin',
    password: '$2a$10$QxJzL6u8jHr.d3p3v8Z9/.3GCjvX9Kj8HwYvN1M2L5Qr7Ss9Tt0uG', // chromato4029
    role: 'admin'
  },
  {
    id: 'user',
    username: 'user', 
    password: '$2a$10$TcFd8h8/3XuVhF2gYzNhOu4mD8.eP3GQs1N7Vk9Lm4Op6Rs8Xx1yS', // Test1234!
    role: 'user'
  }
];

// Initialize password hashes
const initializeUsers = async () => {
  users[0].password = await bcrypt.hash('chromato4029', 10);
  users[1].password = await bcrypt.hash('Test1234!', 10);
  console.log('User passwords initialized');
};

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url} - Origin: ${req.get('Origin') || 'none'}`);
  next();
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Custom middleware to add download protection headers
app.use('/uploads', (req, res, next) => {
  // Add headers to prevent direct downloading
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  
  // Check referrer to prevent hotlinking
  const referrer = req.get('Referrer');
  const host = req.get('Host');
  
  if (referrer && !referrer.includes(host) && !referrer.includes('localhost') && !referrer.includes('192.168')) {
    return res.status(403).json({ error: 'Forbidden: Direct access not allowed' });
  }
  
  next();
});

app.use('/uploads', express.static(UPLOADS_BASE_DIR));

// Storage configuration for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(mp4|mov|avi|mkv|webm)$/i;
    const allowedMimeTypes = [
      'video/mp4',
      'video/quicktime', // .mov files
      'video/x-msvideo', // .avi files
      'video/x-matroska', // .mkv files
      'video/webm'
    ];
    
    if (allowedExtensions.test(file.originalname) && allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'), false);
    }
  }
});

// In-memory storage for video metadata
let videos = [];

// Function to load existing videos from the directory
const loadExistingVideos = async () => {
  try {
    const videosDir = VIDEOS_DIR;
    const thumbnailsDir = THUMBNAILS_DIR;
    
    // Ensure directories exist
    await fs.ensureDir(videosDir);
    await fs.ensureDir(thumbnailsDir);
    
    // Read video files from directory
    const videoFiles = await fs.readdir(videosDir);
    const videoExtensions = /\.(mp4|mov|avi|mkv|webm)$/i;
    
    videos = []; // Clear existing videos array
    
    for (const videoFile of videoFiles) {
      if (videoExtensions.test(videoFile)) {
        const videoPath = path.join(videosDir, videoFile);
        const stats = await fs.stat(videoPath);
        
        // Get video title from filename (remove UUID and extension)
        const fileNameWithoutExt = path.parse(videoFile).name;
        let title = fileNameWithoutExt;
        
        // Try to extract original filename if it follows our UUID pattern
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        if (uuidPattern.test(title)) {
          // If it starts with UUID, use the filename as title for now
          title = fileNameWithoutExt.replace(uuidPattern, '').replace(/^[-_]/, '') || fileNameWithoutExt;
        }
        
        // Check if thumbnail exists
        const possibleThumbnailName = fileNameWithoutExt + '.jpg';
        const thumbnailPath = path.join(thumbnailsDir, possibleThumbnailName);
        const thumbnailExists = await fs.pathExists(thumbnailPath);
        
        // Find subtitle files for this video
        const subtitles = await subtitleUtils.findSubtitleFiles(videoPath, videosDir);
        
        // Create video object with default values first
        // Video conversion will be handled asynchronously
        let actualVideoFile = videoFile;
        let actualVideoUrl = `/uploads/${videoFile}`;
        
        const video = {
          id: fileNameWithoutExt,
          title: title || 'Untitled Video',
          description: '',
          filename: actualVideoFile,
          thumbnail: thumbnailExists ? possibleThumbnailName : 'default.svg',
          uploadDate: stats.birthtime.toISOString(),
          views: 0,
          videoUrl: actualVideoUrl,
          thumbnailUrl: thumbnailExists ? `/uploads/thumbnails/${possibleThumbnailName}` : '/uploads/thumbnails/default.svg',
          subtitles: subtitles,
          originalFile: undefined, // Will be set if conversion happens
          processing: false // Track if video is being processed
        };
        
        videos.push(video);
        
        // Queue video for background processing if it's an AVI file
        if (path.extname(videoFile).toLowerCase() === '.avi') {
          processVideoInBackground(video, videoPath, videosDir);
        }
      }
    }
    
    console.log(`📚 Loaded ${videos.length} existing videos from ${videosDir}`);
    console.log(`🔄 Background processing will start for any videos that need conversion...`);
  } catch (error) {
    console.error('Error loading existing videos:', error);
  }
};

// Function to create default thumbnail if it doesn't exist
const createDefaultThumbnail = async () => {
  try {
    const thumbnailsDir = THUMBNAILS_DIR;
    await fs.ensureDir(thumbnailsDir);
    
    const defaultThumbnailPath = path.join(thumbnailsDir, 'default.svg');
    
    if (!(await fs.pathExists(defaultThumbnailPath))) {
      const defaultSvg = `
<svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f0f0f0"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="16" fill="#999">
    📹 Video Thumbnail
  </text>
</svg>`;
      await fs.writeFile(defaultThumbnailPath, defaultSvg);
      console.log('Created default thumbnail');
    }
  } catch (error) {
    console.error('Error creating default thumbnail:', error);
  }
};

// Function to generate thumbnails for videos that don't have them (background processing)
const generateThumbnails = async () => {
  try {
    const videosDir = VIDEOS_DIR;
    const thumbnailsDir = THUMBNAILS_DIR;
    
    await fs.ensureDir(thumbnailsDir);
    
    console.log(`🎬 Starting background thumbnail generation for ${videos.length} videos...`);
    
    // Process thumbnails in the background without blocking
    setImmediate(async () => {
      let processed = 0;
      let generated = 0;
      
      for (const video of videos) {
        try {
          // Generate thumbnail if:
          // 1. Video is using default.svg (no custom thumbnail)
          // 2. Video has a custom thumbnail name but the file doesn't exist
          const needsThumbnail = video.thumbnail === 'default.svg' || 
                                (video.thumbnail !== 'default.svg' && !(await fs.pathExists(path.join(thumbnailsDir, video.thumbnail))));
          
          if (needsThumbnail) {
            const videoPath = path.join(videosDir, video.filename);
            const thumbnailName = path.parse(video.filename).name + '.jpg';
            const newThumbnailPath = path.join(thumbnailsDir, thumbnailName);
            
            // Check if video file exists
            if (!(await fs.pathExists(videoPath))) {
              console.log(`⚠️ Video file not found for thumbnail generation: ${video.filename}`);
              processed++;
              continue;
            }
            
            // Check if we're going to overwrite an existing thumbnail
            if (await fs.pathExists(newThumbnailPath)) {
              console.log(`📸 Thumbnail already exists for ${video.filename}, updating metadata...`);
              // Update video metadata to use existing thumbnail
              const videoIndex = videos.findIndex(v => v.id === video.id);
              if (videoIndex !== -1) {
                videos[videoIndex].thumbnail = thumbnailName;
                videos[videoIndex].thumbnailUrl = `/uploads/thumbnails/${thumbnailName}`;
              }
              processed++;
              generated++;
              continue;
            }
            
            try {
              console.log(`🎬 [${processed + 1}/${videos.length}] Generating thumbnail for ${video.filename}...`);
              await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                  .screenshots({
                    timestamps: ['10%'],
                    filename: thumbnailName,
                    folder: thumbnailsDir,
                    size: '320x180'
                  })
                  .on('end', () => {
                    console.log(`✅ Generated thumbnail for ${video.filename}`);
                    // Update video metadata
                    const videoIndex = videos.findIndex(v => v.id === video.id);
                    if (videoIndex !== -1) {
                      videos[videoIndex].thumbnail = thumbnailName;
                      videos[videoIndex].thumbnailUrl = `/uploads/thumbnails/${thumbnailName}`;
                    }
                    generated++;
                    resolve();
                  })
                  .on('error', (err) => {
                    console.error(`❌ Error generating thumbnail for ${video.filename}:`, err.message);
                    reject(err);
                  });
              });
            } catch (error) {
              console.error(`❌ Failed to generate thumbnail for ${video.filename}:`, error.message);
              console.log(`📝 Video will continue to use default thumbnail`);
            }
          }
          
          processed++;
          
          // Add a small delay between operations to prevent system overload
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Error processing video ${video.filename}:`, error);
          processed++;
        }
      }
      
      console.log(`🖼️ Background thumbnail generation complete. ${generated}/${videos.length} videos have custom thumbnails.`);
    });
    
  } catch (error) {
    console.error('Error in generateThumbnails:', error);
  }
};

// Generate thumbnail for a video
const generateThumbnail = (videoPath, thumbnailPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['10%'],
        filename: path.basename(thumbnailPath),
        folder: path.dirname(thumbnailPath),
        size: '320x180'
      })
      .on('end', resolve)
      .on('error', reject);
  });
};

// Convert video to browser-compatible format
const convertVideoToBrowserCompatible = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    console.log(`Converting video: ${inputPath} -> ${outputPath}`);
    
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format('mp4')
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-movflags +faststart'
      ])
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Conversion progress: ${Math.round(progress.percent)}%`);
      })
      .on('end', () => {
        console.log(`Video conversion completed: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error('Video conversion error:', err);
        reject(err);
      })
      .save(outputPath);
  });
};

// Check if video needs conversion for browser compatibility
const needsConversion = async (videoPath) => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error('Error probing video:', err);
        resolve(false);
        return;
      }
      
      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
      
      // Check for problematic codecs
      const problemCodecs = [
        'xvid', 'divx', 'wmv3', 'vc1', 'theora', 'vp6f'
      ];
      const problemAudioCodecs = [
        'ac3', 'dts', 'pcm_s16le', 'mp2'
      ];
      
      const needsVideoConversion = videoStream && problemCodecs.includes(videoStream.codec_name?.toLowerCase());
      const needsAudioConversion = audioStream && problemAudioCodecs.includes(audioStream.codec_name?.toLowerCase());
      
      console.log(`Video codec: ${videoStream?.codec_name}, Audio codec: ${audioStream?.codec_name}`);
      console.log(`Needs conversion: ${needsVideoConversion || needsAudioConversion}`);
      
      resolve(needsVideoConversion || needsAudioConversion);
    });
  });
};

// Routes
// Authentication routes
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    }
  });
});

app.get('/api/videos', (req, res) => {
  res.json(videos);
});

app.get('/api/videos/:id', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }
  
  // Increment view count
  video.views++;
  
  res.json(video);
});

// Serve subtitle files as WebVTT
// Handle preflight requests for subtitles
app.options('/api/subtitles/:filename', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

app.get('/api/subtitles/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const subtitlePath = path.join(VIDEOS_DIR, filename);
    
    console.log('=== SUBTITLE REQUEST DEBUG ===');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('User-Agent:', req.get('User-Agent'));
    console.log('Accept:', req.get('Accept'));
    console.log('Range:', req.get('Range'));
    console.log('Origin:', req.get('Origin'));
    console.log('Referer:', req.get('Referer'));
    console.log('All headers:', JSON.stringify(req.headers, null, 2));
    console.log('Subtitle request for:', filename);
    console.log('Looking for file at:', subtitlePath);
    console.log('File exists:', await fs.pathExists(subtitlePath));
    
    // Check if this is a browser request
    const userAgent = req.get('User-Agent') || '';
    const isBrowser = userAgent.includes('Mozilla') && (userAgent.includes('Chrome') || userAgent.includes('Firefox') || userAgent.includes('Safari')) && !userAgent.includes('PowerShell');
    console.log('Is browser request:', isBrowser);
    
    if (!(await fs.pathExists(subtitlePath))) {
      console.log('Subtitle file not found:', subtitlePath);
      return res.status(404).json({ error: 'Subtitle file not found' });
    }
    
    // Read the original file content for debugging
    const originalContent = await fs.readFile(subtitlePath, 'utf8');
    console.log('Original file size:', originalContent.length);
    console.log('First 200 chars:', originalContent.substring(0, 200));
    
    // Convert subtitle to WebVTT format
    const conversionResult = await subtitleUtils.convertSubtitleToVtt(subtitlePath);
    console.log('Conversion result type:', typeof conversionResult);
    console.log('Conversion result keys:', conversionResult ? Object.keys(conversionResult) : 'null');
    
    let vttContent, cssStyles;
    if (conversionResult && typeof conversionResult === 'object' && conversionResult.vtt) {
      vttContent = conversionResult.vtt;
      cssStyles = conversionResult.css || '';
      console.log('CSS styles found:', cssStyles);
    } else if (typeof conversionResult === 'string') {
      // Legacy format - just VTT content
      vttContent = conversionResult;
      cssStyles = '';
    } else {
      vttContent = conversionResult;
      cssStyles = '';
    }
    
    console.log('Converted VTT size:', vttContent ? vttContent.length : 0);
    console.log('VTT preview:', vttContent ? vttContent.substring(0, 200) : 'null');
    
    if (!vttContent) {
      console.log('Failed to convert subtitle file');
      return res.status(500).json({ error: 'Failed to convert subtitle file' });
    }

    // Inject CSS styles into VTT content if they exist
    let finalVttContent = vttContent;
    if (cssStyles && cssStyles.trim()) {
      console.log('Injecting CSS styles into VTT content');
      // Insert CSS after the WEBVTT header
      const lines = vttContent.split('\n');
      const webvttIndex = lines.findIndex(line => line.trim() === 'WEBVTT');
      if (webvttIndex !== -1) {
        lines.splice(webvttIndex + 1, 0, '', 'STYLE', cssStyles, '');
        finalVttContent = lines.join('\n');
        console.log('Final VTT with CSS preview:', finalVttContent.substring(0, 400));
      }
    }

    // Check if this is a Range request
    const range = req.get('Range');
    if (range) {
      console.log('Range request detected:', range);
      // Parse range
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : finalVttContent.length - 1;
      const chunksize = (end - start) + 1;
      const chunk = finalVttContent.slice(start, end + 1);
      
      console.log('Range response - start:', start, 'end:', end, 'chunk size:', chunksize);
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${finalVttContent.length}`);
      res.setHeader('Content-Length', chunksize);
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
      return res.send(chunk);
    }

    // Set Chrome-compatible headers for subtitle tracks
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(finalVttContent, 'utf8'));
    
    // Use different caching strategy for browsers vs other clients
    if (isBrowser) {
      console.log('Setting browser-specific headers...');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    console.log('Sending full response - size:', finalVttContent.length, 'bytes, buffer size:', Buffer.byteLength(finalVttContent, 'utf8'));
    console.log('Response headers being sent:', Object.fromEntries(Object.entries(res.getHeaders())));
    
    // Send as buffer to ensure proper encoding
    res.end(Buffer.from(finalVttContent, 'utf8'));
  } catch (error) {
    console.error('Error serving subtitle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/upload', authenticateToken, requireAdmin, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const videoFilename = req.file.filename;
    const thumbnailFilename = path.parse(videoFilename).name + '.jpg';
    
    const videoPath = path.join(VIDEOS_DIR, videoFilename);
    const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

    // Generate thumbnail
    try {
      await generateThumbnail(videoPath, thumbnailPath);
    } catch (error) {
      console.error('Error generating thumbnail:', error);
    }

    // Get video title from original filename or use provided title
    let title = req.body.title || req.file.originalname;
    if (title.includes('.')) {
      title = path.parse(title).name;
    }

    // Find subtitle files for this video
    const subtitles = await subtitleUtils.findSubtitleFiles(videoPath, VIDEOS_DIR);

    const newVideo = {
      id: path.parse(videoFilename).name,
      title: title,
      description: req.body.description || '',
      filename: videoFilename,
      thumbnail: thumbnailFilename,
      uploadDate: new Date().toISOString(),
      views: 0,
      videoUrl: `/uploads/${videoFilename}`,
      thumbnailUrl: `/uploads/thumbnails/${thumbnailFilename}`,
      subtitles: subtitles
    };

    videos.unshift(newVideo); // Add to beginning of array

    res.json({ 
      message: 'Video uploaded successfully', 
      video: newVideo 
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.delete('/api/videos/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const videoId = req.params.id;
    const videoIndex = videos.findIndex(video => video.id === videoId);
    
    if (videoIndex === -1) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const video = videos[videoIndex];
    
    // Delete video file
    const videoPath = path.join(VIDEOS_DIR, video.filename);
    if (await fs.pathExists(videoPath)) {
      await fs.unlink(videoPath);
    }
    
    // Delete original file if different from converted file
    if (video.originalFile && video.originalFile !== video.filename) {
      const originalPath = path.join(VIDEOS_DIR, video.originalFile);
      if (await fs.pathExists(originalPath)) {
        await fs.unlink(originalPath);
      }
    }
    
    // Delete thumbnail file
    if (video.thumbnail !== 'default.svg') {
      const thumbnailPath = path.join(THUMBNAILS_DIR, video.thumbnail);
      if (await fs.pathExists(thumbnailPath)) {
        await fs.unlink(thumbnailPath);
      }
    }
    
    // Remove from videos array
    videos.splice(videoIndex, 1);
    
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// Convert video endpoint
app.post('/api/videos/:id/convert', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const videoId = req.params.id;
    const video = videos.find(v => v.id === videoId);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const originalPath = path.join(VIDEOS_DIR, video.originalFile || video.filename);
    const convertedFileName = path.parse(video.filename).name + '_converted.mp4';
    const convertedPath = path.join(VIDEOS_DIR, convertedFileName);
    
    // Check if already converted
    if (await fs.pathExists(convertedPath)) {
      return res.json({ message: 'Video already converted', filename: convertedFileName });
    }
    
    // Start conversion
    console.log(`Manual conversion requested for: ${video.title}`);
    
    try {
      await convertVideoToBrowserCompatible(originalPath, convertedPath);
      
      // Update video metadata
      const videoIndex = videos.findIndex(v => v.id === videoId);              if (videoIndex !== -1) {
        videos[videoIndex].filename = convertedFileName;
        videos[videoIndex].videoUrl = `/uploads/${convertedFileName}`;
        videos[videoIndex].originalFile = video.originalFile || video.filename;
      }
      
      res.json({ 
        message: 'Video converted successfully',
        filename: convertedFileName,
        originalFile: video.originalFile || video.filename
      });
    } catch (error) {
      console.error('Conversion failed:', error);
      res.status(500).json({ error: 'Video conversion failed: ' + error.message });
    }
    
  } catch (error) {
    console.error('Convert endpoint error:', error);
    res.status(500).json({ error: 'Conversion request failed' });
  }
});

// Function to convert videos that need browser compatibility (background processing)
const convertVideosInBackground = async () => {
  try {
    console.log('🔄 Checking videos for browser compatibility...');
    
    // Process videos in the background without blocking
    setImmediate(async () => {
      let processed = 0;
      let converted = 0;
      
      for (const video of videos) {
        try {
          const videoPath = path.join(VIDEOS_DIR, video.originalFile || video.filename);
          
          // Check if video file exists
          if (!(await fs.pathExists(videoPath))) {
            console.log(`⚠️ Video file not found: ${video.filename}`);
            processed++;
            continue;
          }
          
          // Check if video needs conversion
          const needsConversion = await needsConversion(videoPath);
          
          if (needsConversion && !video.originalFile) {
            const convertedFileName = path.parse(video.filename).name + '_converted.mp4';
            const convertedPath = path.join(VIDEOS_DIR, convertedFileName);
            
            // Skip if already converted
            if (await fs.pathExists(convertedPath)) {
              console.log(`📹 Converted version already exists for ${video.filename}, updating metadata...`);
              // Update video metadata
              const videoIndex = videos.findIndex(v => v.id === video.id);
              if (videoIndex !== -1) {
                videos[videoIndex].filename = convertedFileName;
                videos[videoIndex].videoUrl = `/uploads/${convertedFileName}`;
                videos[videoIndex].originalFile = video.filename;
              }
              processed++;
              converted++;
              continue;
            }
            
            try {
              console.log(`🔄 [${processed + 1}/${videos.length}] Converting ${video.filename} for browser compatibility...`);
              await convertVideoToBrowserCompatible(videoPath, convertedPath);
              
              // Update video metadata
              const videoIndex = videos.findIndex(v => v.id === video.id);
              if (videoIndex !== -1) {
                videos[videoIndex].filename = convertedFileName;
                videos[videoIndex].videoUrl = `/uploads/${convertedFileName}`;
                videos[videoIndex].originalFile = video.filename;
              }
              
              console.log(`✅ Successfully converted ${video.filename} to ${convertedFileName}`);
              converted++;
            } catch (error) {
              console.error(`❌ Failed to convert ${video.filename}:`, error.message);
            }
          }
          
          processed++;
          
          // Add a small delay between operations to prevent system overload
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`❌ Error processing video ${video.filename}:`, error);
          processed++;
        }
      }
      
      if (converted > 0) {
        console.log(`🎬 Background video conversion complete. Converted ${converted} videos for browser compatibility.`);
      } else {
        console.log(`📹 All videos are already browser compatible.`);
      }
    });
    
  } catch (error) {
    console.error('Error in convertVideosInBackground:', error);
  }
};

// Initialize server
const initializeServer = async () => {
  try {
    console.log('🚀 Initializing JTube server...');
    console.log(`📂 Videos directory: ${VIDEOS_DIR}`);
    console.log(`🖼️ Thumbnails directory: ${THUMBNAILS_DIR}`);
    
    // Initialize users with hashed passwords
    await initializeUsers();
    
    // Ensure the directories exist
    await fs.ensureDir(VIDEOS_DIR);
    await fs.ensureDir(THUMBNAILS_DIR);
    
    // Create default thumbnail
    await createDefaultThumbnail();
    
    // Load existing videos (this needs to complete before server starts)
    await loadExistingVideos();
    
    console.log('✅ Server initialization complete - ready to start server');
  } catch (error) {
    console.error('❌ Error initializing server:', error);
    throw error;
  }
};

// Background tasks to run after server starts
const runBackgroundTasks = () => {
  console.log('🔄 Starting background tasks...');
  
  // Run thumbnail generation in background
  generateThumbnails();
  
  // Run video conversion in background
  convertVideosInBackground();
};

// Start server
const startServer = () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🌟 JTube Server is now running!');
    console.log(`🏠 Local access: http://localhost:${PORT}`);
    console.log(`🌐 Network access: http://YOUR_IP:${PORT}`);
    console.log('');
    
    // Start background tasks after server is running
    runBackgroundTasks();
  });
};

// Initialize and start server
initializeServer().then(() => {
  startServer();
}).catch(error => {
  console.error('❌ Failed to initialize server:', error);
  process.exit(1);
});
