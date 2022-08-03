import { ethers } from 'ethers';
import { firebase, logger } from 'container';
import { firestoreConstants } from '@infinityxyz/lib/utils';
import { Collection, CreationFlow } from '@infinityxyz/lib/types/core';

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
