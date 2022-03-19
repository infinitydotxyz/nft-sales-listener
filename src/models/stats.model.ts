import { getDocRefByTime } from '../utils';
import { CollectionStats } from '../services/OpenSea';
import FirestoreBatchHandler from 'database/FirestoreBatchHandler';
import { Stats, AllTimeStats, StatsPeriod } from '@infinityxyz/lib/types/core';
import { PreAggregationStats } from 'types/PreAggregationStats';
import { getTimestampFromStatsDocId } from '@infinityxyz/lib/utils';

const round = (value: number, decimals: number) => {
  const decimalsFactor = Math.pow(10, decimals);
  return Math.floor(value * decimalsFactor) / decimalsFactor;
};

export const getNewStats = (
  prevStats: PreAggregationStats | undefined,
  incomingStats: PreAggregationStats
): PreAggregationStats => {
  if (!prevStats) {
    return incomingStats;
  }

  const volume = Number.isNaN(prevStats.volume) ? incomingStats.volume : prevStats.volume + incomingStats.volume;
  const numSales = Number.isNaN(prevStats.numSales)
    ? incomingStats.numSales
    : prevStats.numSales + incomingStats.numSales;
  const ceilPrice = Number.isNaN(prevStats.ceilPrice)
    ? incomingStats.ceilPrice
    : Math.max(prevStats.ceilPrice, incomingStats.ceilPrice);
  const floorPrice = Number.isNaN(prevStats.floorPrice)
    ? incomingStats.floorPrice
    : Math.min(prevStats.floorPrice, incomingStats.floorPrice);

  return {
    floorPrice: round(floorPrice, 4),
    ceilPrice: round(ceilPrice, 4),
    volume: round(volume, 4),
    numSales,
    avgPrice: round(volume / numSales, 4),
    updatedAt: incomingStats.updatedAt,
    chainId: incomingStats.chainId,
    collectionAddress: incomingStats.collectionAddress,
    tokenId: incomingStats.tokenId
  };
};

const calcPercentChange = (prev = NaN, current: number) => {
  const change = current - prev;
  const decimal = change / Math.abs(prev);
  const percent = decimal * 100;

  if (Number.isNaN(percent)) {
    return 0;
  }

  return round(percent, 4);
};

export function getPrevStats(
  prevMostRecentStats: Stats,
  prevMostRecentStatsDocId: string,
  onePeriodAgoDocId: string,
  twoPeriodsAgoDocId: string,
  period: StatsPeriod
): Stats {
  let prevStats: Stats;
  /**
   * always carry over floor price, ceil price, avg price
   * 
   * num sales and volume become 0 if there were no sales/volume during the interval
   */
  if (prevMostRecentStatsDocId === onePeriodAgoDocId) {
    prevStats = prevMostRecentStats;
  } else if (prevMostRecentStatsDocId === twoPeriodsAgoDocId) {

    prevStats = {
      chainId: prevMostRecentStats.chainId,
      collectionAddress: prevMostRecentStats.collectionAddress,

      floorPrice: prevMostRecentStats.floorPrice,
      prevFloorPrice: prevMostRecentStats.floorPrice,
      floorPricePercentChange: 0,

      ceilPrice: prevMostRecentStats.ceilPrice,
      prevCeilPrice: prevMostRecentStats.ceilPrice,
      ceilPricePercentChange: 0,

      volume: 0,
      prevVolume: prevMostRecentStats.volume,
      volumePercentChange: calcPercentChange(prevMostRecentStats.volume, 0),

      numSales: 0,
      prevNumSales: prevMostRecentStats.numSales,
      numSalesPercentChange: calcPercentChange(prevMostRecentStats.numSales, 0),

      avgPrice: prevMostRecentStats.avgPrice,
      prevAvgPrice: prevMostRecentStats.avgPrice,
      avgPricePercentChange: 0,

      updatedAt: Date.now(),
      timestamp: getTimestampFromStatsDocId(onePeriodAgoDocId, period)
    };
  } else {
    prevStats = {
      chainId: prevMostRecentStats.chainId,
      collectionAddress: prevMostRecentStats.collectionAddress,

      floorPrice: prevMostRecentStats.floorPrice,
      prevFloorPrice: prevMostRecentStats.floorPrice,
      floorPricePercentChange: 0,

      ceilPrice: prevMostRecentStats.ceilPrice,
      prevCeilPrice: prevMostRecentStats.ceilPrice,
      ceilPricePercentChange: 0,

      volume: 0,
      prevVolume: 0,
      volumePercentChange: 0,

      numSales: 0,
      prevNumSales: 0,
      numSalesPercentChange: 0,

      avgPrice: prevMostRecentStats.avgPrice,
      prevAvgPrice: prevMostRecentStats.avgPrice,
      avgPricePercentChange: 0,

      updatedAt: Date.now(),
      timestamp: getTimestampFromStatsDocId(twoPeriodsAgoDocId, period)
    }
  }
  return prevStats;
}

export function aggregateAllTimeStats(
  currentIntervalStats: PreAggregationStats,
  currentDocId: string,
  period: StatsPeriod.All
): AllTimeStats {
  const allTimeStats: AllTimeStats = {
    ...currentIntervalStats,
    timestamp: getTimestampFromStatsDocId(currentDocId, period)
  };
  return allTimeStats;
}

export function aggregateStats(
  lastIntervalStats: Stats | undefined,
  currentIntervalStats: PreAggregationStats,
  currentDocId: string,
  period: StatsPeriod.Hourly | StatsPeriod.Daily | StatsPeriod.Weekly | StatsPeriod.Monthly | StatsPeriod.Yearly
): Stats {
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
    timestamp: getTimestampFromStatsDocId(currentDocId, period)
  };

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
    updatedAt
  };

  const totalStatsRef = getDocRefByTime(updatedAt, StatsPeriod.All, collectionAddress, chainId);
  const totalStats: AllTimeStats = {
    ...collectionInfo,

    floorPrice: round(openseaStats.floor_price, 4),

    ceilPrice: round(openseaStats.floor_price, 4),

    volume: round(openseaStats.total_volume, 4),

    numSales: round(openseaStats.total_sales, 4),

    avgPrice: round(openseaStats.average_price, 4),

    timestamp: getTimestampFromStatsDocId(totalStatsRef.id, StatsPeriod.All)
  };

  batchHandler.add(totalStatsRef, totalStats, { merge: true });

  // --- Daily ---
  const dailyStatsRef = getDocRefByTime(updatedAt, StatsPeriod.Daily, collectionAddress, chainId);
  const dailyStats: Stats = {
    ...collectionInfo,

    floorPrice: NaN,
    prevFloorPrice: NaN,
    floorPricePercentChange: NaN,

    ceilPrice: NaN,
    prevCeilPrice: NaN,
    ceilPricePercentChange: NaN,

    volume: round(openseaStats.one_day_volume, 4),
    volumePercentChange: NaN,
    prevVolume: NaN,

    numSales: round(openseaStats.one_day_sales, 4),
    prevNumSales: NaN,
    numSalesPercentChange: NaN,

    avgPrice: round(openseaStats.one_day_average_price, 4),
    prevAvgPrice: NaN,
    avgPricePercentChange: NaN,

    timestamp: getTimestampFromStatsDocId(dailyStatsRef.id, StatsPeriod.Daily)
  };
  batchHandler.add(dailyStatsRef, dailyStats, { merge: true });

  // --- Weekly ---
  const weeklyStatsRef = getDocRefByTime(updatedAt, StatsPeriod.Weekly, collectionAddress, chainId);
  const weeklyStats: Stats = {
    ...collectionInfo,
    floorPrice: NaN,
    prevFloorPrice: NaN,
    floorPricePercentChange: NaN,

    ceilPrice: NaN,
    prevCeilPrice: NaN,
    ceilPricePercentChange: NaN,

    volume: round(openseaStats.seven_day_volume, 4),
    volumePercentChange: NaN,
    prevVolume: NaN,

    numSales: round(openseaStats.seven_day_sales, 4),
    prevNumSales: NaN,
    numSalesPercentChange: NaN,

    avgPrice: round(openseaStats.seven_day_average_price, 4),
    prevAvgPrice: NaN,
    avgPricePercentChange: NaN,

    timestamp: getTimestampFromStatsDocId(weeklyStatsRef.id, StatsPeriod.Weekly)
  };
  batchHandler.add(weeklyStatsRef, weeklyStats, { merge: true });

  // --- Monthly ---
  const monthlyStatsRef = getDocRefByTime(updatedAt, StatsPeriod.Monthly, collectionAddress, chainId);
  const monthlyStats: Stats = {
    ...collectionInfo,
    floorPrice: NaN,
    prevFloorPrice: NaN,
    floorPricePercentChange: NaN,

    ceilPrice: NaN,
    prevCeilPrice: NaN,
    ceilPricePercentChange: NaN,

    volume: round(openseaStats.thirty_day_volume, 4),
    volumePercentChange: NaN,
    prevVolume: NaN,

    numSales: round(openseaStats.thirty_day_sales, 4),
    prevNumSales: NaN,
    numSalesPercentChange: NaN,

    avgPrice: round(openseaStats.thirty_day_average_price, 4),
    prevAvgPrice: NaN,
    avgPricePercentChange: NaN,

    timestamp: getTimestampFromStatsDocId(monthlyStatsRef.id, StatsPeriod.Monthly)
  };

  batchHandler.add(monthlyStatsRef, monthlyStats, { merge: true });

  // commit
  await batchHandler.flush();
};

const CollectionStatsModel = { saveInitialCollectionStats };

export default CollectionStatsModel;
