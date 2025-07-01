import { Video } from '../types';

export const getVideoUrl = (video: Video): string => {
  const apiUrl = process.env.REACT_APP_API_URL || '';
  
  // If video is streamed from SFTP, use the streaming URL
  if (video.isStreamed && video.streamUrl) {
    return `${apiUrl}${video.streamUrl}`;
  }
  
  // Otherwise use local file URL
  return `${apiUrl}/uploads/videos/${video.filename}`;
};

export const getThumbnailUrl = (thumbnailPath: string): string => {
  const apiUrl = process.env.REACT_APP_API_URL || '';
  return `${apiUrl}/uploads/${thumbnailPath}`;
};

export const getSubtitleUrl = (subtitle: any): string => {
  const apiUrl = process.env.REACT_APP_API_URL || '';
  
  // If subtitle is streamed from SFTP, use the streaming URL
  if (subtitle.isStreamed && subtitle.url) {
    return `${apiUrl}${subtitle.url}`;
  }
  
  // Otherwise use local file URL
  return `${apiUrl}/api/subtitles/${encodeURIComponent(subtitle.filename)}`;
};
