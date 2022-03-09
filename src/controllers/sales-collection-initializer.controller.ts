/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-unused-vars */
import PQueue from 'p-queue';
import { CollectionStats } from '../services/OpenSea';
import StatsModel from '../models/stats.model';
import { logger, opensea } from '../container';

const taskQueue = new PQueue({ concurrency: 1, interval: 2000, intervalCap: 2 });

const initCollectionStatsFromOS = async (
  collectionAddress: string,
  tokenId: string,
  chainId: string
): Promise<void> => {
  try {
    const { stats: inaccurateStats, slug } = await opensea.getCollectionStatsByTokenInfo(collectionAddress, tokenId);
    if (!slug) {
      throw new Error(`Invalid collection slug: ${slug}`);
    }

    const { stats } = await opensea.getCollectionStats(slug);
    await StatsModel.saveInitialCollectionStats(stats, collectionAddress);
    logger.log(`--- Wrote CollectionStats from OpenSea: [${collectionAddress}]`);
  } catch (err) {
    logger.error('Failed fetching initial collection stats from opensea for', chainId, collectionAddress, err);
  }
};

export const addCollectionToQueue = async (collectionAddr: string, tokenId: string, chainId = '1'): Promise<void> => {
  await taskQueue.add(async () => await initCollectionStatsFromOS(collectionAddr, tokenId, chainId));
};
