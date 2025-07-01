export const getVideoUrl = (filename: string): string => {
  const apiUrl = process.env.REACT_APP_API_URL || '';
  return `${apiUrl}/uploads/${filename}`;
};

export const getThumbnailUrl = (thumbnailPath: string): string => {
  const apiUrl = process.env.REACT_APP_API_URL || '';
  return `${apiUrl}/${thumbnailPath}`;
};
