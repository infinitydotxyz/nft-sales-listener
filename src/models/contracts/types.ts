import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { InfinityExchangeContract } from './infinity-exchange.contract';
import { InfinityStakerContract } from './infinity-staker.contract';
import { OpenSeaContract } from './opensea.contract';
import { SeaportContract } from './seaport.contract';

export type ContractType = InfinityExchangeContract | OpenSeaContract | SeaportContract | InfinityStakerContract;
export type ContractConstructors =
  | typeof InfinityExchangeContract
  | typeof OpenSeaContract
  | typeof SeaportContract
  | typeof InfinityStakerContract;

export interface ContractDescription {
  address: string;
  chainId: ChainId;
  type: ContractConstructors;
  numBlocksToBackfill?: number;
}

export enum Contracts {
  InfinityExchange = 'InfinityExchange',
  InfinityStaker = 'InfinityStaker',
  OpenSea = 'OpenSea',
  Seaport = 'Seaport'
}
