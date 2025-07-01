export interface Video {
  _id: string;
  title: string;
  description: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadDate: Date;
  uploader: string;
  thumbnailPath?: string;
  duration?: number;
  views: number;
  subtitles?: SubtitleTrack[];
  isStreamed?: boolean; // Flag to indicate if video is streamed from SFTP
  streamUrl?: string; // URL for streaming from SFTP
}

export interface SubtitleTrack {
  filename: string;
  language: string;
  label: string;
  url: string;
  css?: string;
  colors?: Record<string, string>;
  isStreamed?: boolean; // Flag to indicate if subtitle is streamed from SFTP
  size?: number; // File size for SFTP subtitles
}
