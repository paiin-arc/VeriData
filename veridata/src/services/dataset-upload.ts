import { ShelbyNodeClient } from '../lib/client';
import { validateDataset } from '../utils/validators';
import { uploadDatasetToShelby } from '../lib/shelby';
import { DatasetMetadata } from '../types/dataset';

export class DatasetUploadService {
  private client: ShelbyNodeClient;

  constructor() {
    this.client = new ShelbyNodeClient({
      network: Network.TESTNET
    });
  }

  async uploadDataset(file: Express.Multer.File): Promise<DatasetMetadata> {
    if (!validateDataset(file)) {
      throw new Error('Invalid dataset file');
    }

    const buffer = await this.convertFileToBuffer(file);
    const metadata = await uploadDatasetToShelby(this.client, buffer, file.originalname);

    return metadata;
  }

  private convertFileToBuffer(file: Express.Multer.File): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(Buffer.from(reader.result as ArrayBuffer));
      reader.onerror = reject;
      reader.readAsArrayBuffer(file.buffer);
    });
  }
}