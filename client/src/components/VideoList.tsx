import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './VideoList.css';
import { fetchVideos } from '../services/videoService';
import { Video } from '../types';

const VideoList: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    const loadVideos = async () => {
      try {
        setLoading(true);
        const videoData = await fetchVideos();
        setVideos(videoData);
      } catch (err) {
        console.error('Error loading videos:', err);
        setError('Failed to load videos. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadVideos();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="video-list-container">
      <h2>Latest Videos</h2>
      <div className="video-grid">
        {videos.length === 0 ? (
          <p className="no-videos">No videos available.</p>
        ) : (
          videos.map(video => (
            <Link to={`/video/${video.id}`} className="video-card" key={video.id}>
              <div className="video-thumbnail">
                <img 
                  src={`${apiUrl}/thumbnails/${video.thumbnailUrl}`} 
                  alt={video.title}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `${apiUrl}/thumbnails/default.svg`;
                  }}
                />
              </div>
              <div className="video-info">
                <h3>{video.title}</h3>
                <p className="video-uploader">{video.username}</p>
                <p className="video-stats">
                  {video.views} views • {new Date(video.uploadDate).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default VideoList;
