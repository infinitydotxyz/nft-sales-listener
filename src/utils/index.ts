import { BASE_TIME } from '../types';
import { ethers } from 'ethers';
import moment from 'moment';
import { firebase } from 'container';
import { getDocIdHash, trimLowerCase } from '@infinityxyz/lib/utils';
import { COLLECTION_STATS_COLL, NFT_STATS_COLL } from '../constants';

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

  const collectionStatsRef = firebase.db.collection(COLLECTION_STATS_COLL).doc(`${chainId}:${trimLowerCase(collectionAddress)}`);
  let statsRef = collectionStatsRef;

  if(typeof tokenId === 'string') {
    const nftDocId = getDocIdHash({
      chainId,
      collectionAddress: trimLowerCase(collectionAddress),
      tokenId: tokenId
    });
    const nftStatsRef = firebase.db.collection(NFT_STATS_COLL).doc(nftDocId);
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
