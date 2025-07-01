export interface Video {
  id: string;
  title: string;
  description: string;
  uploadDate: string;
  url: string;
  thumbnailUrl: string;
  userId: string;
  username: string;
  views: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Comment {
  id: string;
  text: string;
  userId: string;
  username: string;
  videoId: string;
  createdAt: string;
}
