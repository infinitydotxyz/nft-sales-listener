import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { InfinityExchangeContract } from './infinity-exchange.contract';
import { InfinityStakerContract } from './infinity-staker.contract';

export type ContractType = InfinityExchangeContract | InfinityStakerContract;
export type ContractConstructors = typeof InfinityExchangeContract | typeof InfinityStakerContract;

export interface ContractDescription {
  address: string;
  chainId: ChainId;
  type: ContractConstructors;
  numBlocksToBackfill?: number;
}

export enum Contracts {
  InfinityExchange = 'InfinityExchange',
  InfinityStaker = 'InfinityStaker'
}
