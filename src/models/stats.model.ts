import { getDocRefByTime } from '../utils';
import { CollectionStats } from '../services/OpenSea';
import FirestoreBatchHandler from 'database/FirestoreBatchHandler';
import { Stats, AllTimeStats, StatsPeriod } from '@infinityxyz/lib/types/core';
import { PreAggregationStats } from 'types/PreAggregationStats';
import { AllTimeStatsTimestampType, parseStatsDocId } from '@infinityxyz/lib/utils';

export const getNewStats = (prevStats: PreAggregationStats | undefined, incomingStats: PreAggregationStats): PreAggregationStats => {
  if (!prevStats) {
    return incomingStats;
  }

  const volume = prevStats.volume + incomingStats.volume;
  const numSales = prevStats.numSales + incomingStats.numSales;
  return {
    floorPrice: Math.min(prevStats.floorPrice, incomingStats.floorPrice),
    ceilPrice: Math.max(prevStats.ceilPrice, incomingStats.ceilPrice),
    volume,
    numSales,
    avgPrice: volume / numSales,
    updatedAt: incomingStats.updatedAt,
    chainId: incomingStats.chainId,
    collectionAddress: incomingStats.collectionAddress,
    tokenId: incomingStats.tokenId
  };
};

export const aggregateStats = (lastIntervalStats: Stats | undefined, currentIntervalStats: PreAggregationStats, currentDocId: string, period: StatsPeriod): Stats => {
  const calcPercentChange = (prev = NaN, current: number) => {
    const change = prev - current;
    const decimal = change / Math.abs(prev);
    const percent = decimal * 100;

    if(Number.isNaN(percent)) {
      return current;
    }

    return percent;
  }
  const aggregated: Stats = {
    ...currentIntervalStats,
    prevFloorPrice: lastIntervalStats?.floorPrice ?? NaN,
    floorPricePercentChange: calcPercentChange(lastIntervalStats?.floorPrice, currentIntervalStats.floorPrice),
    prevCeilPrice: lastIntervalStats?.ceilPrice ?? NaN,
    ceilPricePercentChange: calcPercentChange(lastIntervalStats?.ceilPrice, currentIntervalStats.ceilPrice),

    prevVolume: lastIntervalStats?.volume ?? NaN,
    volumePercentChange: calcPercentChange(lastIntervalStats?.volume, currentIntervalStats.volume),

    prevNumSales: lastIntervalStats?.numSales ?? NaN,

    numSalesPercentChange: calcPercentChange(lastIntervalStats?.numSales, currentIntervalStats.numSales),

    prevAvgPrice: lastIntervalStats?.avgPrice ?? NaN,

    avgPricePercentChange: calcPercentChange(lastIntervalStats?.avgPrice, currentIntervalStats.avgPrice),

    timestamp: parseStatsDocId(currentDocId).timestamp,

    period: period
  }

  return aggregated;
}

const saveInitialCollectionStats = async (
  openseaStats: CollectionStats,
  collectionAddress: string,
  chainId = '1'
): Promise<void> => {
  const batchHandler = new FirestoreBatchHandler();
  const updatedAt = Date.now();
  const collectionInfo = {
    chainId,
    collectionAddress,
    updatedAt,
  }



  const totalStatsRef = getDocRefByTime(updatedAt, StatsPeriod.All, collectionAddress, chainId);
  const totalStats: AllTimeStats = {
    ...collectionInfo,

    floorPrice: openseaStats.floor_price,

    ceilPrice: openseaStats.floor_price,

    volume: openseaStats.total_volume,

    numSales: openseaStats.total_sales,

    avgPrice: openseaStats.average_price,

    timestamp: parseStatsDocId(totalStatsRef.id).timestamp as AllTimeStatsTimestampType,

    period: StatsPeriod.All
  };

  batchHandler.add(totalStatsRef, totalStats, { merge: true });

  // --- Daily ---
  const dailyStatsRef = getDocRefByTime(updatedAt, StatsPeriod.Daily, collectionAddress, chainId);
  const dailyStats: Stats = {
    ...collectionInfo,

    floorPrice: 0,
    prevFloorPrice: 0,
    floorPricePercentChange: 0,

    ceilPrice: 0,
    prevCeilPrice: 0,
    ceilPricePercentChange: 0,

    volume: openseaStats.one_day_volume,
    volumePercentChange: 0,
    prevVolume: openseaStats.one_day_volume,

    numSales: openseaStats.one_day_sales,
    prevNumSales: openseaStats.one_day_sales,
    numSalesPercentChange: 0,

    avgPrice: openseaStats.one_day_average_price,
    prevAvgPrice: openseaStats.one_day_average_price,
    avgPricePercentChange: 0,

    timestamp: parseStatsDocId(dailyStatsRef.id).timestamp,
    period: StatsPeriod.Daily
  }
  batchHandler.add(
    dailyStatsRef,
    dailyStats,
    { merge: true }
  );

  // --- Weekly ---
  const weeklyStatsRef = getDocRefByTime(updatedAt, StatsPeriod.Weekly, collectionAddress, chainId);
  const weeklyStats: Stats = {
    ...collectionInfo,
    floorPrice: 0,
    prevFloorPrice: 0,
    floorPricePercentChange: 0,

    ceilPrice: 0,
    prevCeilPrice: 0,
    ceilPricePercentChange: 0,

    volume: openseaStats.seven_day_volume,
    volumePercentChange: 0,
    prevVolume: openseaStats.seven_day_volume,

    numSales: openseaStats.seven_day_sales,
    prevNumSales: openseaStats.seven_day_sales,
    numSalesPercentChange: 0,

    avgPrice: openseaStats.seven_day_average_price,
    prevAvgPrice: openseaStats.seven_day_average_price,
    avgPricePercentChange: 0,

    timestamp: parseStatsDocId(weeklyStatsRef.id).timestamp,
    period: StatsPeriod.Weekly,
  }
  batchHandler.add(
    weeklyStatsRef,
    weeklyStats,
    { merge: true }
  );

  // --- Monthly ---
  const monthlyStatsRef = getDocRefByTime(updatedAt, StatsPeriod.Monthly, collectionAddress, chainId);
  const monthlyStats: Stats = {
    ...collectionInfo,
    floorPrice: 0,
    prevFloorPrice: 0,
    floorPricePercentChange: 0,

    ceilPrice: 0,
    prevCeilPrice: 0,
    ceilPricePercentChange: 0,

    volume: openseaStats.thirty_day_volume,
    volumePercentChange: 0,
    prevVolume: openseaStats.thirty_day_volume,

    numSales: openseaStats.thirty_day_sales,
    prevNumSales: openseaStats.thirty_day_sales,
    numSalesPercentChange: 0,

    avgPrice: openseaStats.thirty_day_average_price,
    prevAvgPrice: openseaStats.thirty_day_average_price,
    avgPricePercentChange: 0,

    timestamp: parseStatsDocId(monthlyStatsRef.id).timestamp,
    period: StatsPeriod.Monthly,
  };

  batchHandler.add(
    monthlyStatsRef,
    monthlyStats,
    { merge: true }
  );

  // commit
  await batchHandler.flush();
};

const CollectionStatsModel = { saveInitialCollectionStats };

export default CollectionStatsModel;
