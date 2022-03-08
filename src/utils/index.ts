import crypto from 'crypto';

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

export enum Env {
  Cli = 'cli',
  Script = 'script',
  Production = 'production'
}

export function getEnv(): Env {
  switch (process.env.NODE_ENV) {
    case Env.Cli:
      return Env.Cli;
    case Env.Script:
      return Env.Script;
    default:
      if (process.env.NODE_ENV) {
        throw new Error(`Invalid NODE_ENV: ${process.env.NODE_ENV}`);
      }
      return Env.Production;
  }
}

export function getSearchFriendlyString(input: string): string {
  if (!input) {
    return '';
  }
  // remove spaces, dashes and underscores only
  const output = input.replace(/[\s-_]/g, '');
  return output.toLowerCase();
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
