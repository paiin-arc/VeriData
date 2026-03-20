import { extname } from 'path';

const ALLOWED_FILE_TYPES = ['.csv', '.json', '.txt', '.xlsx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const validateFileType = (fileName: string): boolean => {
  const fileExtension = extname(fileName).toLowerCase();
  return ALLOWED_FILE_TYPES.includes(fileExtension);
};

export const validateFileSize = (fileSize: number): boolean => {
  return fileSize <= MAX_FILE_SIZE;
};