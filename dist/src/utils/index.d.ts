import { JsonRpcProvider } from '@ethersproject/providers';
import { BASE_TIME } from '../types';
/**
 *
 * @param date
 * @param baseTime
 * @returns Firestore historical document id ( sales info ) based on date and basetime
 *
 */
export declare const getDocumentIdByTime: (timestamp: number, baseTime: BASE_TIME) => string;
export declare const convertWeiToEther: (price: BigInt) => number;
export declare function getProviderByChainId(chainId: string): JsonRpcProvider;
export declare function filterDuplicates<T>(items: T[], propertySelector: (item: T) => string): T[];
export declare function sleep(duration: number): Promise<void>;
export declare function isDev(): boolean;
/**
 * returns a random int between min (inclusive) and max (inclusive)
 */
export declare function randomInt(min: number, max: number): number;
export declare function randomItem<T>(array: T[]): T;
/**
 *
 * @description  tokenIds can be big in some cases and we might run into firestore doc name length limit
 *
 */
export declare const getHashByNftAddress: (chainId: string, collectionAddress: string, tokenId: string) => string;
