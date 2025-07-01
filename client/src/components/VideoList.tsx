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

  if (loading) {
    return <div className="loading">Loading videos...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="container">
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
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="thumbnail-placeholder">
                      <span>📹</span>
                    </div>
                  )}
                </div>
                <div className="video-info">
                  <h3 className="video-title">{video.title}</h3>
                  <p className="video-description">
                    {video.description.length > 100 
                      ? `${video.description.substring(0, 100)}...` 
                      : video.description
                    }
                  </p>
                  <div className="video-meta">
                    <span className="video-date">
                      {new Date(video.uploadDate).toLocaleDateString()}
                    </span>
                    <span className="video-views">{video.views} views</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoList;
