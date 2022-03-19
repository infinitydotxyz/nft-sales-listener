import { getDocRefByTime, getDocumentRefByTime } from '../utils';
import { CollectionStats } from '../services/OpenSea';
import FirestoreBatchHandler from 'database/FirestoreBatchHandler';
import { Stats, StatsPeriod } from '@infinityxyz/lib/types/core';

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
  openseaStats: CollectionStats,
  collectionAddress: string,
  chainId = '1'
): Promise<void> => {
  const batchHandler = new FirestoreBatchHandler();

  const timestamp = Date.now();
  const totalInfo: Stats = {
    chainId,
    collectionAddress,

    floorPrice: openseaStats.floor_price,
    prevFloorPrice: openseaStats.floor_price,
    

    ceilPrice: openseaStats.floor_price,
    prevCeilPrice: openseaStats.floor_price,
    ceilPricePercentChange: 0,

    volume: openseaStats.total_volume,
    numSales: openseaStats.total_sales,
    avgPrice: openseaStats.average_price,
    floorPriceChange: 0,

    updatedAt: timestamp
  };
  const totalStatsRef = getDocRefByTime(timestamp, StatsPeriod, collectionAddress, chainId);
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
