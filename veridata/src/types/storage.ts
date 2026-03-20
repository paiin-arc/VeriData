export interface BlobMetadata {
  id: string;
  size: number;
  contentType: string;
  createdAt: Date;
  updatedAt: Date;
  expirationTime?: Date;
}

export interface StorageResponse {
  success: boolean;
  message: string;
  data?: BlobMetadata;
}

export interface UploadOptions {
  shouldExpire?: boolean;
  expirationDuration?: number; // in seconds
}