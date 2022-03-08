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
<<<<<<< HEAD
    const isInitialized = await StatsModel.checkIfCollInitialized(collectionAddress);
    if (isInitialized) return;

    const cs: CollectionStats = await openseaClient.getCollectionStatsByTokenInfo(collectionAddress, tokenId, chainId);
    await StatsModel.initStatsFromOS(cs, collectionAddress);

    await StatsModel.setCollInitialization(collectionAddress);

=======
    const cs: CollectionStats = await opensea.getCollectionStatsByTokenInfo(collectionAddress, tokenId, chainId);
    await StatsModel.saveInitialCollectionStats(cs, collectionAddress);
>>>>>>> f56a8870bde328525d93eb1bc1525e6c56ed3d39
    logger.log(`--- Wrote CollectionStats from OpenSea: [${collectionAddress}]`);
  } catch (err) {
    logger.error('Failed fetching initial collection stats from opensea for', chainId, collectionAddress, err);
  }
};

export const addCollectionToQueue = async (collectionAddr: string, tokenId: string, chainId = '1'): Promise<void> => {
  await taskQueue.add(async () => await initCollectionStatsFromOS(collectionAddr, tokenId, chainId));
};
