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
const Client = require('ssh2-sftp-client');
const os = require('os');

// Set the path to ffmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

// Set explicit FFmpeg paths for Windows installation
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
const UPLOADS_BASE_DIR = path.join(__dirname, '..', 'uploads');
const VIDEOS_DIR = path.join(UPLOADS_BASE_DIR, 'videos');
const THUMBNAILS_DIR = path.join(UPLOADS_BASE_DIR, 'thumbnails');

const app = express();
const PORT = process.env.PORT || 10001;
const JWT_SECRET = 'your-secret-key-change-in-production';

// SFTP Server configuration
const SFTP_CONFIG = {
  host: '192.168.0.152',
  port: 22,
  username: 'chromatography0429',
  password: '1204',
  remotePath: '/Volumes/Second Volume/Video/Animation/드래곤볼_Kai'
};

// SFTP client instance
const sftp = new Client();

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

// SFTP connection management
let sftpConnected = false;

const connectSFTP = async () => {
  try {
    if (!sftpConnected) {
      await sftp.connect(SFTP_CONFIG);
      sftpConnected = true;
      console.log('✅ Connected to SFTP server:', SFTP_CONFIG.host);
    }
    return true;
  } catch (error) {
    console.error('❌ SFTP connection failed:', error.message);
    sftpConnected = false;
    return false;
  }
};

const disconnectSFTP = async () => {
  try {
    if (sftpConnected) {
      await sftp.end();
      sftpConnected = false;
      console.log('🔌 Disconnected from SFTP server');
    }
  } catch (error) {
    console.error('❌ SFTP disconnect error:', error.message);
  }
};

// Function to catalog videos from SFTP server (no download)
const syncVideosFromSFTP = async () => {
  try {
    console.log('🔄 Cataloging videos from SFTP server...');
    
    if (!(await connectSFTP())) {
      console.log('❌ Cannot sync videos - SFTP connection failed');
      return;
    }
    
    // List files on SFTP server
    const remoteFiles = await sftp.list(SFTP_CONFIG.remotePath);
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const videoFiles = remoteFiles.filter(file => 
      file.type === '-' && videoExtensions.includes(path.extname(file.name).toLowerCase())
    );
    
    console.log(`📁 Found ${videoFiles.length} video files on SFTP server`);
    
    for (const remoteFile of videoFiles) {
      try {
        const fileName = remoteFile.name;
        const fileNameWithoutExt = path.parse(fileName).name;
        
        // Check if this video is already in our system
        const existingVideo = videos.find(v => v.filename === fileName);
        if (!existingVideo) {
          // Find subtitle files on SFTP server
          const subtitleExtensions = ['.srt', '.vtt', '.smi', '.sami'];
          const subtitleFiles = remoteFiles.filter(file => 
            file.type === '-' && 
            subtitleExtensions.includes(path.extname(file.name).toLowerCase()) &&
            file.name.startsWith(fileNameWithoutExt)
          );
          
          // Catalog subtitle files (no download)
          const subtitles = [];
          for (const subFile of subtitleFiles) {
            const language = subtitleUtils.detectLanguage(subFile.name);
            const label = subtitleUtils.getLanguageLabel(language);
            
            subtitles.push({
              filename: subFile.name,
              path: null, // No local path for SFTP-streamed files
              extension: path.extname(subFile.name).toLowerCase(),
              language: language,
              label: label,
              url: `/api/subtitles/sftp/${encodeURIComponent(subFile.name)}`,
              isStreamed: true, // Flag to indicate this is streamed from SFTP
              size: subFile.size
            });
            
            console.log(`📄 Cataloged subtitle: ${subFile.name}`);
          }
          
          // Create video object for SFTP-streamed content
          const newVideo = {
            _id: fileNameWithoutExt,
            title: fileNameWithoutExt,
            description: 'Streamed from SFTP server',
            filename: fileName,
            originalName: fileName,
            mimetype: 'video/mp4', // Default
            size: remoteFile.size,
            uploadDate: remoteFile.modifyTime ? remoteFile.modifyTime.toISOString() : new Date().toISOString(),
            uploader: 'sftp-sync',
            thumbnailPath: 'thumbnails/default.svg',
            views: 0,
            subtitles: subtitles,
            processing: false,
            isStreamed: true, // Flag to indicate this is streamed from SFTP
            streamUrl: `/api/videos/sftp/${encodeURIComponent(fileName)}`
          };
          
          videos.unshift(newVideo);
          console.log(`✅ Cataloged SFTP video: ${fileName}`);
        } else {
          // Update existing video metadata if file has changed
          if (existingVideo.size !== remoteFile.size) {
            console.log(`📝 Updating metadata for changed video: ${fileName}`);
            existingVideo.size = remoteFile.size;
            existingVideo.uploadDate = remoteFile.modifyTime ? remoteFile.modifyTime.toISOString() : existingVideo.uploadDate;
          }
        }
        
      } catch (error) {
        console.error(`❌ Error cataloging video ${remoteFile.name}:`, error.message);
      }
    }
    
    console.log('🎬 SFTP video cataloging completed');
    
  } catch (error) {
    console.error('❌ Error cataloging videos from SFTP:', error.message);
  }
};

// Function to upload video to SFTP server
const uploadVideoToSFTP = async (localPath, remoteFileName) => {
  try {
    if (!(await connectSFTP())) {
      throw new Error('SFTP connection failed');
    }
    
    console.log(`⬆️ Uploading ${remoteFileName} to SFTP server...`);
    await sftp.fastPut(localPath, `${SFTP_CONFIG.remotePath}/${remoteFileName}`);
    console.log(`✅ Successfully uploaded ${remoteFileName} to SFTP server`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error uploading to SFTP:`, error.message);
    throw error;
  }
};

// Function to upload subtitle file to SFTP server
const uploadSubtitleToSFTP = async (localPath, remoteFileName) => {
  try {
    if (!(await connectSFTP())) {
      throw new Error('SFTP connection failed');
    }
    
    console.log(`⬆️ Uploading subtitle ${remoteFileName} to SFTP server...`);
    await sftp.fastPut(localPath, `${SFTP_CONFIG.remotePath}/${remoteFileName}`);
    console.log(`✅ Successfully uploaded subtitle ${remoteFileName} to SFTP server`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error uploading subtitle to SFTP:`, error.message);
    throw error;
  }
};

// Function to stream video from SFTP server
const streamVideoFromSFTP = async (remoteFileName) => {
  try {
    if (!(await connectSFTP())) {
      throw new Error('SFTP connection failed');
    }
    
    const remotePath = `${SFTP_CONFIG.remotePath}/${remoteFileName}`;
    console.log(`📺 Creating stream for SFTP video: ${remotePath}`);
    
    // Get file stats first
    const fileStats = await sftp.stat(remotePath);
    const stream = sftp.createReadStream(remotePath);
    
    return {
      stream: stream,
      size: fileStats.size,
      mtime: fileStats.mtime
    };
  } catch (error) {
    console.error(`❌ Error streaming video from SFTP:`, error.message);
    throw error;
  }
};

// Function to stream subtitle from SFTP server
const streamSubtitleFromSFTP = async (remoteFileName) => {
  try {
    if (!(await connectSFTP())) {
      throw new Error('SFTP connection failed');
    }
    
    const remotePath = `${SFTP_CONFIG.remotePath}/${remoteFileName}`;
    console.log(`📄 Creating stream for SFTP subtitle: ${remotePath}`);
    
    // Get file stats first
    const fileStats = await sftp.stat(remotePath);
    const stream = sftp.createReadStream(remotePath);
    
    return {
      stream: stream,
      size: fileStats.size,
      mtime: fileStats.mtime
    };
  } catch (error) {
    console.error(`❌ Error streaming subtitle from SFTP:`, error.message);
    throw error;
  }
};

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost and local network access
    if (
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin.startsWith('http://192.168.') ||
      origin.startsWith('http://10.') ||
      origin.startsWith('http://172.')
    ) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
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
        
        // Create video object for local files
        const video = {
          _id: fileNameWithoutExt,
          title: title || 'Untitled Video',
          description: '',
          filename: videoFile,
          originalName: videoFile,
          mimetype: 'video/mp4', // Default, could be improved by detecting actual type
          size: stats.size,
          uploadDate: stats.birthtime.toISOString(),
          uploader: 'system',
          thumbnailPath: thumbnailExists ? `thumbnails/${possibleThumbnailName}` : 'thumbnails/default.svg',
          views: 0,
          subtitles: subtitles,
          originalFile: undefined, // Will be set if conversion happens
          processing: false, // Track if video is being processed
          isStreamed: false // Local files are not streamed
        };
        
        videos.push(video);
      }
    }
    
    console.log(`📚 Loaded ${videos.length} existing local videos from ${videosDir}`);
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

// SFTP Server information endpoint
app.get('/api/sftp/info', authenticateToken, (req, res) => {
  res.json({
    sftpServer: {
      host: SFTP_CONFIG.host,
      port: SFTP_CONFIG.port,
      username: SFTP_CONFIG.username,
      remotePath: SFTP_CONFIG.remotePath,
      connected: sftpConnected,
      lastSync: new Date().toISOString()
    }
  });
});

// Manual SFTP sync endpoint
app.post('/api/sftp/sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await syncVideosFromSFTP();
    res.json({ message: 'SFTP sync completed successfully' });
  } catch (error) {
    console.error('SFTP sync error:', error);
    res.status(500).json({ error: 'SFTP sync failed: ' + error.message });
  }
});

app.get('/api/videos', (req, res) => {
  res.json(videos);
});

app.get('/api/videos/:id', (req, res) => {
  const video = videos.find(v => v._id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }
  
  // Increment view count
  video.views++;
  
  res.json(video);
});

// Stream video from SFTP server
app.get('/api/videos/sftp/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    console.log(`🎬 SFTP video stream request for: ${filename}`);
    
    const streamData = await streamVideoFromSFTP(filename);
    const { stream, size } = streamData;
    
    // Set appropriate headers for video streaming
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Handle range requests for video seeking
    const range = req.headers.range;
    if (range) {
      console.log(`📺 Range request for SFTP video: ${range}`);
      
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', chunksize);
      
      // For range requests, we need to create a new stream
      stream.destroy();
      const rangeStreamData = await streamVideoFromSFTP(filename);
      const rangeStream = rangeStreamData.stream;
      
      // Skip to the start position and limit to the range
      let bytesRead = 0;
      let bytesToSend = chunksize;
      let rangeStarted = false;
      
      rangeStream.on('data', (chunk) => {
        if (bytesToSend <= 0) {
          rangeStream.destroy();
          return;
        }
        
        const chunkStart = bytesRead;
        const chunkEnd = bytesRead + chunk.length - 1;
        
        if (chunkEnd < start) {
          // This chunk is before our range
          bytesRead += chunk.length;
          return;
        }
        
        if (chunkStart > end) {
          // This chunk is after our range
          rangeStream.destroy();
          res.end();
          return;
        }
        
        // This chunk overlaps with our range
        const startOffset = Math.max(0, start - chunkStart);
        const endOffset = Math.min(chunk.length, bytesToSend + startOffset);
        const rangeChunk = chunk.slice(startOffset, endOffset);
        
        res.write(rangeChunk);
        bytesRead += chunk.length;
        bytesToSend -= rangeChunk.length;
        rangeStarted = true;
        
        if (bytesToSend <= 0) {
          rangeStream.destroy();
          res.end();
        }
      });
      
      rangeStream.on('end', () => {
        if (!res.headersSent || rangeStarted) {
          res.end();
        }
      });
      
      rangeStream.on('error', (error) => {
        console.error('SFTP video stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error' });
        }
      });
      
    } else {
      // Full file stream
      stream.pipe(res);
      
      stream.on('error', (error) => {
        console.error('SFTP video stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error' });
        }
      });
    }
    
  } catch (error) {
    console.error('Error streaming video from SFTP:', error);
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

// Stream subtitle from SFTP server
app.get('/api/subtitles/sftp/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    console.log(`📄 SFTP subtitle stream request for: ${filename}`);
    
    const streamData = await streamSubtitleFromSFTP(filename);
    const { stream } = streamData;
    
    // Set appropriate headers for subtitle streaming
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Read the subtitle content from stream
    let subtitleContent = '';
    
    stream.on('data', (chunk) => {
      subtitleContent += chunk.toString('utf8');
    });
    
    stream.on('end', async () => {
      try {
        // Convert subtitle content to VTT format
        const tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}_${filename}`);
        await fs.writeFile(tempFilePath, subtitleContent, 'utf8');
        
        const conversionResult = await subtitleUtils.convertSubtitleToVtt(tempFilePath);
        
        // Clean up temp file
        await fs.unlink(tempFilePath).catch(() => {});
        
        let vttContent, cssStyles;
        if (conversionResult && typeof conversionResult === 'object' && conversionResult.vtt) {
          vttContent = conversionResult.vtt;
          cssStyles = conversionResult.css || '';
        } else {
          vttContent = conversionResult || '';
          cssStyles = '';
        }
        
        // Inject CSS styles into VTT content if they exist
        let finalVttContent = vttContent;
        if (cssStyles && cssStyles.trim()) {
          const lines = vttContent.split('\n');
          const webvttIndex = lines.findIndex(line => line.trim() === 'WEBVTT');
          if (webvttIndex !== -1) {
            lines.splice(webvttIndex + 1, 0, '', 'STYLE', cssStyles, '');
            finalVttContent = lines.join('\n');
          }
        }
        
        res.setHeader('Content-Length', Buffer.byteLength(finalVttContent, 'utf8'));
        res.end(Buffer.from(finalVttContent, 'utf8'));
        
      } catch (error) {
        console.error('Error converting SFTP subtitle:', error);
        res.status(500).json({ error: 'Failed to convert subtitle' });
      }
    });
    
    stream.on('error', (error) => {
      console.error('SFTP subtitle stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      }
    });
    
  } catch (error) {
    console.error('Error streaming subtitle from SFTP:', error);
    res.status(500).json({ error: 'Failed to stream subtitle' });
  }
});

// Get subtitles for a specific video
app.get('/api/videos/:id/subtitles', async (req, res) => {
  try {
    const video = videos.find(v => v._id === req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json(video.subtitles);
  } catch (error) {
    console.error('Error fetching subtitles:', error);
    res.status(500).json({ error: 'Failed to fetch subtitles' });
  }
});

// Serve subtitle files as WebVTT (for local files)
app.get('/api/subtitles/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const subtitlePath = path.join(VIDEOS_DIR, filename);
    
    if (!(await fs.pathExists(subtitlePath))) {
      return res.status(404).json({ error: 'Subtitle file not found' });
    }
    
    // Convert subtitle to WebVTT format
    const conversionResult = await subtitleUtils.convertSubtitleToVtt(subtitlePath);
    
    let vttContent, cssStyles;
    if (conversionResult && typeof conversionResult === 'object' && conversionResult.vtt) {
      vttContent = conversionResult.vtt;
      cssStyles = conversionResult.css || '';
    } else {
      vttContent = conversionResult || '';
      cssStyles = '';
    }
    
    // Inject CSS styles into VTT content if they exist
    let finalVttContent = vttContent;
    if (cssStyles && cssStyles.trim()) {
      const lines = vttContent.split('\n');
      const webvttIndex = lines.findIndex(line => line.trim() === 'WEBVTT');
      if (webvttIndex !== -1) {
        lines.splice(webvttIndex + 1, 0, '', 'STYLE', cssStyles, '');
        finalVttContent = lines.join('\n');
      }
    }

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(finalVttContent, 'utf8'));
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
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
      _id: path.parse(videoFilename).name,
      title: title,
      description: req.body.description || '',
      filename: videoFilename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadDate: new Date().toISOString(),
      uploader: req.user.username,
      thumbnailPath: `thumbnails/${thumbnailFilename}`,
      views: 0,
      subtitles: subtitles,
      isStreamed: false
    };

    videos.unshift(newVideo); // Add to beginning of array

    // Upload to SFTP server in background
    setImmediate(async () => {
      try {
        await uploadVideoToSFTP(videoPath, videoFilename);
        console.log(`✅ Video ${videoFilename} uploaded to SFTP server`);
        
        // Upload subtitle files to SFTP if they exist
        if (subtitles && subtitles.length > 0) {
          for (const subtitle of subtitles) {
            if (subtitle.path) {
              try {
                await uploadSubtitleToSFTP(subtitle.path, subtitle.filename);
              } catch (error) {
                console.error(`❌ Failed to upload subtitle ${subtitle.filename} to SFTP server:`, error.message);
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ Failed to upload ${videoFilename} to SFTP server:`, error.message);
      }
    });

    res.json({ 
      message: 'Video uploaded successfully', 
      video: newVideo 
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

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
    
    // Load existing local videos
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
  
  // Initial SFTP sync
  setTimeout(async () => {
    console.log('🔄 Starting initial SFTP sync...');
    await syncVideosFromSFTP();
    
    // Set up periodic SFTP sync every 5 minutes
    setInterval(async () => {
      console.log('🔄 Starting periodic SFTP sync...');
      await syncVideosFromSFTP();
    }, 5 * 60 * 1000); // 5 minutes
  }, 5000); // Wait 5 seconds after server start
};

// Start server
const startServer = () => {
  // Start HTTP server
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🌟 JTube Server is now running!');
    console.log(`🏠 Local access: http://localhost:${PORT}`);
    console.log(`🌐 Network access: http://YOUR_IP:${PORT}`);
    console.log('');
    console.log('📁 SFTP Configuration:');
    console.log(`🔌 SFTP Server: ${SFTP_CONFIG.host}:${SFTP_CONFIG.port}`);
    console.log(`👤 SFTP User: ${SFTP_CONFIG.username}`);
    console.log(`📂 SFTP Remote Path: ${SFTP_CONFIG.remotePath}`);
    console.log('⏰ Auto-sync: Every 5 minutes');
    console.log('');
    console.log('📋 Usage:');
    console.log('   - Videos are automatically cataloged from SFTP server (streaming mode)');
    console.log('   - Upload videos via web interface to sync to SFTP');
    console.log('   - Manual sync available via API: POST /api/sftp/sync');
    console.log('   - Videos and subtitles are streamed directly from SFTP');
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await disconnectSFTP();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await disconnectSFTP();
  process.exit(0);
});
