import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './UploadVideo.css';
import { uploadVideo } from '../services/videoService';

interface FormData {
  title: string;
  description: string;
  video: File | null;
  thumbnail: File | null;
}

const UploadVideo: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    video: null,
    thumbnail: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const { name } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: e.target.files && e.target.files[0],
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title) {
      setError('Please enter a title');
      return;
    }
    
    if (!formData.video) {
      setError('Please select a video to upload');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create a FormData object for the upload
      const uploadFormData = new FormData();
      uploadFormData.append('title', formData.title);
      uploadFormData.append('description', formData.description);
      if (formData.video) {
        uploadFormData.append('video', formData.video);
      }
      if (formData.thumbnail) {
        uploadFormData.append('thumbnail', formData.thumbnail);
      }

      // Upload the video
      await uploadVideo(uploadFormData, (progress) => {
        setUploadProgress(progress);
      });
      
      // Redirect to the home page after successful upload
      navigate('/');
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to upload video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-form-container">
        <h2>Upload Video</h2>
        {error && <div className="error-message">{error}</div>}
        <form className="upload-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              disabled={loading}
              rows={5}
            />
          </div>
          <div className="form-group">
            <label htmlFor="video">Video File *</label>
            <input
              type="file"
              id="video"
              name="video"
              accept="video/*"
              onChange={handleFileChange}
              disabled={loading}
              required
            />
            <small>Supported formats: MP4, WebM (max size: 500MB)</small>
          </div>
          <div className="form-group">
            <label htmlFor="thumbnail">Custom Thumbnail (optional)</label>
            <input
              type="file"
              id="thumbnail"
              name="thumbnail"
              accept="image/*"
              onChange={handleFileChange}
              disabled={loading}
            />
            <small>Supported formats: JPG, PNG (recommended size: 1280×720)</small>
          </div>
          
          {loading && (
            <div className="progress-container">
              <div 
                className="progress-bar" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
              <span>{uploadProgress}% Uploaded</span>
            </div>
          )}

          <button type="submit" className="upload-button" disabled={loading}>
            {loading ? 'Uploading...' : 'Upload Video'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadVideo;
