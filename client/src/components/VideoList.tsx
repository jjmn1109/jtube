import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Video } from '../types';
import { fetchVideos } from '../services/videoService';
import { getThumbnailUrl } from '../utils/urlUtils';
import './VideoList.css';

const VideoList: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVideos = async () => {
      try {
        const videosData = await fetchVideos();
        setVideos(videosData);
      } catch (err) {
        setError('Failed to load videos');
        console.error('Error loading videos:', err);
      } finally {
        setLoading(false);
      }
    };

    loadVideos();
  }, []);

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="loading">Loading videos...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="video-list">
      <h2>Latest Videos</h2>
      {videos.length === 0 ? (
        <p className="no-videos">No videos available</p>
      ) : (
        <div className="video-grid">
          {videos.map((video) => (
            <Link key={video._id} to={`/video/${video._id}`} className="video-card">
              <div className="video-thumbnail">
                {video.thumbnailPath ? (
                  <img 
                    src={getThumbnailUrl(video.thumbnailPath)} 
                    alt={video.title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = getThumbnailUrl('default.svg');
                    }}
                  />
                ) : (
                  <div className="thumbnail-placeholder">
                    <span>📹</span>
                  </div>
                )}
                <div className="video-duration">{formatDuration(video.duration)}</div>
              </div>
              <div className="video-info">
                <h3 className="video-title">{video.title}</h3>
                <div className="video-meta">
                  <div>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                    {video.views.toLocaleString()} views
                  </div>
                  <div>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                    </svg>
                    {new Date(video.uploadDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoList;
