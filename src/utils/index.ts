import { ethers } from 'ethers';
import { firebase } from 'container';
import { firestoreConstants, getCollectionDocId, getStatsCollName, getStatsDocId, StatsType } from '@infinityxyz/lib/utils';
import { NftSale } from '@infinityxyz/lib/types/core/NftSale';
import { StatsPeriod } from '@infinityxyz/lib/types/core';
import { Transaction } from 'types/Transaction';
import { PreAggregationStats } from 'types/PreAggregationStats';

/**
 * returns a random int between min (inclusive) and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomItem<T>(array: T[]): T {
  const index = randomInt(0, array.length - 1);
  return array[index];
}


export const convertWeiToEther = (price: BigInt): number => {
  return parseFloat(ethers.utils.formatEther(price.toString()));
};

export const getDocRefByTime = (
  timestamp: number,
  period: StatsPeriod,
  collectionAddress: string,
  chainId: string,
  tokenId?: string
): FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData> => {
  const collectionRef = firebase.db
    .collection(firestoreConstants.COLLECTIONS_COLL)
    .doc(getCollectionDocId({ collectionAddress, chainId }));


    /**
     * collection or nft ref
     */
  let baseRef: FirebaseFirestore.DocumentReference = collectionRef;
  let type: StatsType = StatsType.Collection;

  if (typeof tokenId === 'string') {
    const nftDocId = tokenId;
    const nftRef = collectionRef.collection(firestoreConstants.COLLECTION_NFTS_COLL).doc(nftDocId);
    baseRef = nftRef;
    type = StatsType.Nft;
  }

  
  const collectionName = getStatsCollName(period, type);
  const docId = getStatsDocId(timestamp, period);
  const statsRef = baseRef.collection(collectionName).doc(docId);


  return statsRef;
};

export function getIncomingStats(data: Transaction | NftSale): PreAggregationStats {
  if ('totalPrice' in data) {
    const numSales = data.sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const incomingStats: PreAggregationStats = {
      chainId: data.sales[0].chainId,
      collectionAddress: data.sales[0].collectionAddress,
      floorPrice: data.sales[0].price,
      ceilPrice: data.sales[0].price,
      volume: data.sales[0].price * numSales,
      numSales,
      avgPrice: data.sales[0].price,
      updatedAt: data.sales[0].timestamp,
    };
    return incomingStats;
  }

  const incomingStats: PreAggregationStats = {
    chainId: data.chainId,
    collectionAddress: data.collectionAddress,
    tokenId: data.tokenId,
    floorPrice: data.price,
    ceilPrice: data.price,
    volume: data.price,
    numSales: 1,
    avgPrice: data.price,
    updatedAt: data.timestamp
  };
  return incomingStats;
}