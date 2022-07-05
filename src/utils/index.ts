import { ethers } from 'ethers';
import { firebase, logger } from 'container';
import {
  firestoreConstants,
  getCollectionDocId
} from '@infinityxyz/lib/utils';
import { getStatsDocInfo } from 'utils/stats';
import { NftSale } from '@infinityxyz/lib/types/core/NftSale';
import { Collection, CreationFlow, StatsPeriod } from '@infinityxyz/lib/types/core';
import { PreAggregationStats } from 'types/PreAggregationStats';
import { TransactionType } from 'types/Transaction';

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
  const isNft = typeof tokenId === 'string';

  if (isNft) {
    const nftDocId = tokenId;
    const nftRef = collectionRef.collection(firestoreConstants.COLLECTION_NFTS_COLL).doc(nftDocId);
    baseRef = nftRef;
  }

  const collectionName: string = isNft ? firestoreConstants.NFT_STATS_COLL : firestoreConstants.COLLECTION_STATS_COLL;
  const { docId } = getStatsDocInfo(timestamp, period);

  const statsRef = baseRef.collection(collectionName).doc(docId);

  return statsRef;
};

export function getIncomingStats(data: TransactionType | NftSale): PreAggregationStats {
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
      updatedAt: data.sales[0].timestamp
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


export function isCollectionIndexed(collection?: Partial<Collection>): boolean {
  return collection?.state?.create?.step === CreationFlow.Complete;
}

export async function getUsername(address: string): Promise<string> {
  try {
    const user = await firebase.db.collection(firestoreConstants.USERS_COLL).doc(address).get();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user?.data?.()?.username ?? '';
  } catch (err) {
    logger.error(`Failed to get user doc for ${address}`);
    return '';
  }
}