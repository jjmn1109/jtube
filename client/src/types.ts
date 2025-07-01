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
}

export interface SubtitleTrack {
  filename: string;
  language: string;
  label: string;
  url: string;
  css?: string;
  colors?: Record<string, string>;
}
