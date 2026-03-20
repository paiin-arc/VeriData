export interface DatasetMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  owner: string;
  size: number; // in bytes
  format: string; // e.g., 'csv', 'json', etc.
  tags?: string[]; // optional tags for categorization
}

export interface DatasetUploadResponse {
  success: boolean;
  message: string;
  metadata?: DatasetMetadata;
}

export interface DatasetValidationResult {
  isValid: boolean;
  errors?: string[];
}