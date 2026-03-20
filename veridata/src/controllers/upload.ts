import { Request, Response } from 'express';
import { uploadDataset } from '../services/dataset-upload';
import { validateDataset } from '../utils/validators';

export const uploadController = async (req: Request, res: Response) => {
  try {
    const dataset = req.body;

    // Validate the incoming dataset
    const validationErrors = validateDataset(dataset);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    // Upload the dataset to Shelby storage
    const uploadResult = await uploadDataset(dataset);

    // Return the upload metadata
    return res.status(200).json({ message: 'Dataset uploaded successfully', data: uploadResult });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};