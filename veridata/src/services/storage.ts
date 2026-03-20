import { ShelbyNodeClient } from '@shelby-protocol/sdk/dist/node/clients/ShelbyNodeClient';
import { Network } from '@shelby-labs/sdk';
import { BlobMetadata } from '../types/storage';

const shelbyClient = new ShelbyNodeClient({
  network: Network.TESTNET,
  apiKey: process.env.SHELBY_API_KEY
});

export const getBlobMetadata = async (blobId: string): Promise<BlobMetadata> => {
  try {
    const metadata = await shelbyClient.getBlobMetadata(blobId);
    return metadata;
  } catch (error) {
    throw new Error(`Failed to retrieve blob metadata: ${error.message}`);
  }
};

export const listBlobs = async (ownerId: string): Promise<BlobMetadata[]> => {
  try {
    const blobs = await shelbyClient.listBlobs(ownerId);
    return blobs;
  } catch (error) {
    throw new Error(`Failed to list blobs: ${error.message}`);
  }
};