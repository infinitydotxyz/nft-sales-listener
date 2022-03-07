import crypto from 'crypto';
import { logger, providers } from '../container';
import { JsonRpcProvider } from '@ethersproject/providers';
import { BASE_TIME, NftTransaction } from '../types';
import { ethers } from 'ethers';
import moment from 'moment';

/**
 *
 * @param date
 * @param baseTime
 * @returns Firestore historical document id ( sales info ) based on date and basetime
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


export function getProviderByChainId(chainId: string): JsonRpcProvider {
  return providers.getProviderByChainId(chainId);
}

export function filterDuplicates<T>(items: T[], propertySelector: (item: T) => string): T[] {
  const hashes = new Set();
  return items.filter((item: T) => {
    const property = propertySelector(item);
    if (!hashes.has(property)) {
      hashes.add(property);
      return true;
    }
    return false;
  });
}

export async function sleep(duration: number): Promise<void> {
  return await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

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
 * @description  tokenIds can be big in some cases and we might run into firestore doc name length limit
 *
 */
export const getHashByNftAddress = (chainId: string, collectionAddress: string, tokenId: string): string => {
  const data = chainId + collectionAddress.trim() + tokenId.trim();
  return crypto.createHash('sha256').update(data).digest('hex').trim().toLowerCase();
};
