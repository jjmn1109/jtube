import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import './VideoPlayer.css';
import { fetchVideo, fetchVideos } from '../services/videoService';
import { Video } from '../types';

const VideoPlayer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    const loadVideo = async () => {
      try {
        if (id) {
          setLoading(true);
          const videoData = await fetchVideo(id);
          setVideo(videoData);
          
          // Load all videos for the sidebar
          const allVideos = await fetchVideos();
          // Filter out the current video
          const filteredVideos = allVideos.filter(v => v.id !== id);
          setRelatedVideos(filteredVideos);
        }
      } catch (err) {
        console.error('Error loading video:', err);
        setError('Failed to load video. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadVideo();
  }, [id, apiUrl]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error || !video) {
    return <div className="error">{error || 'Video not found'}</div>;
  }

  return (
    <div className="video-page-container">
      <div className="video-main-content">
        <div className="video-player-container">
          <video 
            controls 
            autoPlay 
            className="video-player"
            src={`${apiUrl}/videos/${video.url}`}
          />
        </div>
        <div className="video-info">
          <h1>{video.title}</h1>
          <div className="video-meta">
            <span>{new Date(video.uploadDate).toLocaleDateString()}</span>
            <span>{video.views} views</span>
            <span>Uploaded by: {video.username}</span>
          </div>
          <p className="video-description">{video.description}</p>
        </div>
      </div>

      <div className="video-sidebar">
        <h3>More videos</h3>
        <div className="related-videos-list">
          {relatedVideos.map(relatedVideo => (
            <Link 
              to={`/video/${relatedVideo.id}`} 
              className="related-video-item" 
              key={relatedVideo.id}
            >
              <div className="related-video-thumbnail">
                <img 
                  src={`${apiUrl}/thumbnails/${relatedVideo.thumbnailUrl}`} 
                  alt={relatedVideo.title}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `${apiUrl}/thumbnails/default.svg`;
                  }}
                />
              </div>
              <div className="related-video-info">
                <h4>{relatedVideo.title}</h4>
                <p>{relatedVideo.username}</p>
                <p>{relatedVideo.views} views • {new Date(relatedVideo.uploadDate).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
