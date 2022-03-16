import { BASE_TIME } from '../types';
import { ethers } from 'ethers';
import moment from 'moment';
import { firebase } from 'container';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';

export function isDev(): boolean {
  return !!process.env.NODE_ENV;
}

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

/**
 *
 * @param date
 * @param baseTime
 * @returns Firestore historical document id ( sales info ) based on date and base time
 *
 */
export const getDocumentIdByTime = (timestamp: number, baseTime: BASE_TIME): string => {
  const date = new Date(timestamp);
  const firstDayOfWeek = date.getDate() - date.getDay();

  switch (baseTime) {
    case BASE_TIME.HOURLY:
      return moment(date).format('YYYY-MM-DD-HH');
    case BASE_TIME.DAILY:
      return moment(date).format('YYYY-MM-DD');
    case BASE_TIME.WEEKLY:
      return moment(date.setDate(firstDayOfWeek)).format('YYYY-MM-DD');
    case BASE_TIME.MONTHLY:
      return moment(date).format('YYYY-MM');
    case BASE_TIME.YEARLY:
      return moment(date).format('YYYY');
  }
};

export const convertWeiToEther = (price: BigInt): number => {
  return parseFloat(ethers.utils.formatEther(price.toString()));
};


export const getDocumentRefByTime = (timestamp: number, baseTime: BASE_TIME | 'total', collectionAddress: string, chainId: string, tokenId?: string): FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData> => {
  const date = new Date(timestamp);
  const firstDayOfWeek = date.getDate() - date.getDay();

  const collectionRef = firebase.db.collection(firestoreConstants.COLLECTIONS_COLL).doc(getCollectionDocId({collectionAddress, chainId}));
  let statsRef = collectionRef.collection(firestoreConstants.DATA_SUB_COL).doc(firestoreConstants.COLLECTION_STATS_DOC);

  if(typeof tokenId === 'string') {
    const nftDocId = tokenId;
    const nftStatsRef = collectionRef.collection(firestoreConstants.COLLECTION_NFTS_COLL).doc(nftDocId).collection(firestoreConstants.DATA_SUB_COL).doc(firestoreConstants.NFT_STATS_DOC);
    statsRef = nftStatsRef;
  }

  let docId = '';
  switch (baseTime) {
    case BASE_TIME.HOURLY:
      docId = moment(date).format('YYYY-MM-DD-HH');
      return statsRef.collection(baseTime).doc(docId);
    case BASE_TIME.DAILY:
      docId = moment(date).format('YYYY-MM-DD');
      return statsRef.collection(baseTime).doc(docId);
    case BASE_TIME.WEEKLY:
      docId = moment(date.setDate(firstDayOfWeek)).format('YYYY-MM-DD');
      return statsRef.collection(baseTime).doc(docId);
    case BASE_TIME.MONTHLY:
      docId = moment(date).format('YYYY-MM');
      return statsRef.collection(baseTime).doc(docId);
    case BASE_TIME.YEARLY:
      docId = moment(date).format('YYYY');
      return statsRef.collection(baseTime).doc(docId);
    case 'total':
      return statsRef
  }
}
