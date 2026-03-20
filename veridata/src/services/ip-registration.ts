import { StoryProtocol } from '@shelby-protocol/sdk';
import { ShelbyNodeClient } from 'node_modules/@shelby-protocol/sdk/dist/node/clients/ShelbyNodeClient';
import { DatasetMetadata } from '../types/dataset';
import { getShelbyClient } from '../lib/client';

const shelbyClient = getShelbyClient();

export const registerIntellectualProperty = async (dataset: DatasetMetadata, ownerAddress: string): Promise<string> => {
  try {
    const storyProtocol = new StoryProtocol(shelbyClient);
    const registrationResult = await storyProtocol.registerIP(dataset, ownerAddress);
    return registrationResult.transactionId;
  } catch (error) {
    throw new Error(`IP registration failed: ${error.message}`);
  }
};