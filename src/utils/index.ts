import { ethers } from 'ethers';

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
