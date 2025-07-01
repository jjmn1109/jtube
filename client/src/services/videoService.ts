import axios from 'axios';
import { Video, SubtitleTrack } from '../types';

export const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? `http://${window.location.hostname}:10001/api`
  : '/api';

export const fetchVideos = async (): Promise<Video[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/videos`);
    return response.data;
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
};

export const fetchVideo = async (id: string): Promise<Video> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/videos/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching video ${id}:`, error);
    throw error;
  }
};

export const uploadVideo = async (
  formData: FormData, 
  onProgress?: (progress: number) => void
): Promise<Video> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/videos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
};

export const fetchSubtitles = async (videoId: string): Promise<SubtitleTrack[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/videos/${videoId}/subtitles`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching subtitles for video ${videoId}:`, error);
    return [];
  }
};

export const fetchSubtitleContent = async (filename: string): Promise<{vtt: string, css: string}> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/subtitles/${encodeURIComponent(filename)}/content`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching subtitle content for ${filename}:`, error);
    throw error;
  }
};
