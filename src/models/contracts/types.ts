import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { InfinityExchangeContract } from './infinity-exchange.contract';
import { OpenSeaContract } from './opensea.contract';
import { SeaportContract } from './seaport.contract';

export type ContractType = InfinityExchangeContract | OpenSeaContract | SeaportContract;
export type ContractConstructors = typeof InfinityExchangeContract | typeof OpenSeaContract | typeof SeaportContract;

export interface ContractDescription {
  address: string;
  chainId: ChainId;
  type: ContractConstructors;
}

export enum Contracts {
  InfinityExchange = 'InfinityExchange',
  InfinityStaker = 'InfinityStaker',
  OpenSea = 'OpenSea',
  Seaport = 'Seaport'
}
