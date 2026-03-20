import { Request, Response } from 'express';
import { registerIP } from '../services/ip-registration';

export const registerDatasetIP = async (req: Request, res: Response) => {
  try {
    const { datasetId, owner, metadata } = req.body;

    if (!datasetId || !owner || !metadata) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await registerIP(datasetId, owner, metadata);
    return res.status(200).json({ message: 'Intellectual property registered successfully', result });
  } catch (error) {
    console.error('Error registering intellectual property:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};