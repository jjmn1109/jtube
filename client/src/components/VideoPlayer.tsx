import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Video, SubtitleTrack } from '../types';
import { fetchVideo, fetchSubtitles, fetchSubtitleContent } from '../services/videoService';
import { getVideoUrl } from '../utils/urlUtils';
import './VideoPlayer.css';

const VideoPlayer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [subtitleStyles, setSubtitleStyles] = useState<string>('');

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

  if (loading) {
    return <div className="loading">Loading video...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!video) {
    return <div className="error">Video not found</div>;
  }

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
            poster={video.thumbnailPath ? `/uploads/thumbnails/${video.thumbnailPath}` : undefined}
            crossOrigin="anonymous"
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
    </div>
  );
};

export default VideoPlayer;
