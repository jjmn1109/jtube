import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Video, SubtitleTrack } from '../types';
import { fetchVideo, fetchVideos, fetchSubtitles, fetchSubtitleContent } from '../services/videoService';
import { getVideoUrl, getThumbnailUrl } from '../utils/urlUtils';
import './VideoPlayer.css';

const VideoPlayer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [subtitleStyles, setSubtitleStyles] = useState<string>('');

  // Load all videos for the side list
  useEffect(() => {
    const loadAllVideos = async () => {
      try {
        const videos = await fetchVideos();
        setAllVideos(videos);
      } catch (err) {
        console.error('Error loading videos:', err);
      }
    };
    loadAllVideos();
  }, []);

  useEffect(() => {
    const loadVideo = async () => {
      if (!id) {
        setError('No video ID provided');
        setLoading(false);
        return;
      }

      try {
        const videoData = await fetchVideo(id);
        setVideo(videoData);
        
        // Load subtitles for this video
        const subtitleData = await fetchSubtitles(id);
        setSubtitles(subtitleData);
        
        // Load CSS styles for subtitles with colors
        let combinedStyles = '';
        for (const subtitle of subtitleData) {
          try {
            const content = await fetchSubtitleContent(subtitle.filename);
            if (content.css) {
              combinedStyles += content.css + '\n';
            }
          } catch (err) {
            console.warn(`Failed to load CSS for subtitle ${subtitle.filename}:`, err);
          }
        }
        setSubtitleStyles(combinedStyles);
        
      } catch (err) {
        setError('Failed to load video');
        console.error('Error loading video:', err);
      } finally {
        setLoading(false);
      }
    };

    loadVideo();
  }, [id]);

  // Handle video end and autoplay next
  const handleVideoEnd = () => {
    if (video && allVideos.length > 0) {
      const currentIndex = allVideos.findIndex(v => v._id === video._id);
      const nextIndex = (currentIndex + 1) % allVideos.length;
      const nextVideo = allVideos[nextIndex];
      navigate(`/video/${nextVideo._id}`);
    }
  };

  // Set up autoplay when video component mounts or changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.autoplay = true;
    }
  }, [video]);

  if (loading) {
    return <div className="loading">Loading video...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!video) {
    return <div className="error">Video not found</div>;
  }

  // Filter out the current video from side list
  const sideVideos = allVideos.filter(v => v._id !== video._id);

  return (
    <div className="container">
      {/* Inject subtitle CSS styles */}
      {subtitleStyles && (
        <style dangerouslySetInnerHTML={{ __html: subtitleStyles }} />
      )}
      
      <div className="video-player">
        <div className="video-container">
          <video 
            ref={videoRef}
            controls 
            className="video-element"
            src={getVideoUrl(video.filename)}
            poster={video.thumbnailPath ? getThumbnailUrl(video.thumbnailPath) : undefined}
            crossOrigin="anonymous"
            onEnded={handleVideoEnd}
          >
            {subtitles.map((subtitle, index) => (
              <track
                key={index}
                kind="subtitles"
                src={subtitle.url}
                srcLang={subtitle.language}
                label={subtitle.label}
                default={index === 0}
              />
            ))}
            Your browser does not support the video tag.
          </video>
        </div>
        
        <div className="video-details">
          <h1 className="video-title">{video.title}</h1>
          
          <div className="video-meta">
            <span className="video-views">{video.views} views</span>
            <span className="video-date">
              Uploaded on {new Date(video.uploadDate).toLocaleDateString()}
            </span>
          </div>
          
          <div className="video-description">
            <h3>Description</h3>
            <p>{video.description}</p>
          </div>
          
          <div className="video-info">
            <p><strong>File:</strong> {video.originalName}</p>
            <p><strong>Size:</strong> {(video.size / (1024 * 1024)).toFixed(2)} MB</p>
            <p><strong>Type:</strong> {video.mimetype}</p>
            {video.duration && (
              <p><strong>Duration:</strong> {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="side-videos">
        {sideVideos.map(video => (
          <Link key={video._id} to={`/video/${video._id}`} className="side-video-card">
            <div className="side-video-thumbnail">
              <img 
                src={getThumbnailUrl(video.thumbnailPath || 'thumbnails/default.svg')} 
                alt={video.title}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div className="side-video-info">
              <h3 className="side-video-title">{video.title}</h3>
              <div className="side-video-meta">
                <div>{video.views} views</div>
                <div>{new Date(video.uploadDate).toLocaleDateString()}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default VideoPlayer;
