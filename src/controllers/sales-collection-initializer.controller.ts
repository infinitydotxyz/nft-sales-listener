/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-unused-vars */
import PQueue from 'p-queue';
import OpenSea, { CollectionStats } from '../services/OpenSea';
import StatsModel from '../models/stats.model';
import { logger } from '../container';

const taskQueue = new PQueue({ concurrency: 1, interval: 2000, intervalCap: 2 });
const openseaClient = new OpenSea();

const initCollectionStatsFromOS = async (
  collectionAddress: string,
  tokenId: string,
  chainId: string
): Promise<void> => {
  try {
    const cs: CollectionStats = await openseaClient.getCollectionStatsByTokenInfo(collectionAddress, tokenId);
    await StatsModel.initStatsFromOS(cs, collectionAddress);
    logger.log(`--- Wrote CollectionStats from OpenSea: [${collectionAddress}]`);
  } catch (err) {
    logger.error('opensea-sales-listener: [initCollectionStatsFromOS]', { collectionAddress });
    throw err;
  }
};

export const addCollectionToQueue = async (collectionAddr: string, tokenId: string, chainId = '1'): Promise<void> => {
  await taskQueue.add(async () => await initCollectionStatsFromOS(collectionAddr, tokenId, chainId));
};
