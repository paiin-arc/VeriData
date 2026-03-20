import { v4 as uuidv4 } from 'uuid';

export const formatTimestamp = (date: Date): string => {
  return date.toISOString();
};

export const generateDatasetFingerprint = (data: any): string => {
  const uniqueString = JSON.stringify(data) + uuidv4();
  return uniqueString;
};

export const validateFileType = (file: File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.type);
};

export const validateFileSize = (file: File, maxSize: number): boolean => {
  return file.size <= maxSize;
};