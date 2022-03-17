import { getDocumentRefByTime } from '../utils';
import { BASE_TIME, Stats } from '../types';
import { CollectionStats } from '../services/OpenSea';
import FirestoreBatchHandler from 'database/FirestoreBatchHandler';

export const getNewStats = (prevStats: Stats | undefined, incomingStats: Stats): Stats => {
  if (!prevStats) {
    return incomingStats;
  }

  const totalVolume = prevStats.totalVolume + incomingStats.totalVolume;
  const totalNumSales = prevStats.totalNumSales + incomingStats.totalNumSales;
  return {
    floorPrice: Math.min(prevStats.floorPrice, incomingStats.floorPrice),
    ceilPrice: Math.max(prevStats.ceilPrice, incomingStats.ceilPrice),
    totalVolume,
    totalNumSales,
    avgPrice: totalVolume / totalNumSales,
    updatedAt: incomingStats.updatedAt,
    chainId: incomingStats.chainId,
    collectionAddress: incomingStats.collectionAddress,
    tokenId: incomingStats.tokenId
  };
};

const saveInitialCollectionStats = async (
  cs: CollectionStats,
  collectionAddress: string,
  chainId = '1'
): Promise<void> => {
  const batchHandler = new FirestoreBatchHandler();

  const timestamp = Date.now();
  const totalInfo: Stats = {
    chainId,
    collectionAddress,
    floorPrice: cs.floor_price,
    ceilPrice: 0,
    totalVolume: cs.total_volume,
    totalNumSales: cs.total_sales,
    avgPrice: cs.average_price,
    updatedAt: timestamp
  };
  const totalStatsRef = getDocumentRefByTime(timestamp, 'total', collectionAddress, chainId);
  batchHandler.add(totalStatsRef, totalInfo, { merge: true });

  // --- Daily ---
  const dailyStatsRef = getDocumentRefByTime(timestamp, BASE_TIME.DAILY, collectionAddress, chainId);
  batchHandler.add(
    dailyStatsRef,
    {
      floorPrice: 0,
      ceilPrice: 0,
      totalVolume: cs.one_day_volume,
      totalNumSales: cs.one_day_sales,
      avgPrice: cs.one_day_average_price,
      updatedAt: timestamp
    },
    { merge: true }
  );

  // --- Weekly ---
  const weeklyStatsRef = getDocumentRefByTime(timestamp, BASE_TIME.WEEKLY, collectionAddress, chainId);
  batchHandler.add(
    weeklyStatsRef,
    {
      floorPrice: 0,
      ceilPrice: 0,
      totalVolume: cs.seven_day_volume,
      totalNumSales: cs.seven_day_sales,
      avgPrice: cs.seven_day_average_price,
      updatedAt: timestamp
    },
    { merge: true }
  );

  // --- Monthly ---
  const monthlyStatsRef = getDocumentRefByTime(timestamp, BASE_TIME.MONTHLY, collectionAddress, chainId);
  batchHandler.add(
    monthlyStatsRef,
    {
      floorPrice: 0,
      ceilPrice: 0,
      totalVolume: cs.thirty_day_volume,
      totalNumSales: cs.thirty_day_sales,
      avgPrice: cs.thirty_day_average_price,
      updatedAt: timestamp
    },
    { merge: true }
  );

  // commit
  await batchHandler.flush();
};

const CollectionStatsModel = { saveInitialCollectionStats };

export default CollectionStatsModel;
