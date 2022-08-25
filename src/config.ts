import { ChainId } from '@infinityxyz/lib/types/core';
import { getExchangeAddress, getStakerAddress } from '@infinityxyz/lib/utils';
import { WYVERN_EXCHANGE_ADDRESS } from '@infinityxyz/lib/utils/constants';
import { SEAPORT_ADDRESS } from './constants/wyvern-constants';
import { InfinityExchangeContract } from './models/contracts/infinity-exchange.contract';
import { InfinityStakerContract } from './models/contracts/infinity-staker.contract';
import { OpenSeaContract } from './models/contracts/opensea.contract';
import { SeaportContract } from './models/contracts/seaport.contract';
import { ContractDescription } from './models/contracts/types';

export const infinityExchangeMainnetDesc: ContractDescription = {
  address: getExchangeAddress(ChainId.Mainnet),
  chainId: ChainId.Mainnet,
  type: InfinityExchangeContract
};

export const wyvernExchangeMainnetDesc: ContractDescription = {
  address: WYVERN_EXCHANGE_ADDRESS,
  chainId: ChainId.Mainnet,
  type: OpenSeaContract,
  numBlocksToBackfill: 0
};

export const seaportExchangeMainnetDesc: ContractDescription = {
  address: SEAPORT_ADDRESS,
  chainId: ChainId.Mainnet,
  type: SeaportContract,
  numBlocksToBackfill: 0
};

export const infinityStakerMainnetDesc: ContractDescription = {
  address: getStakerAddress(ChainId.Mainnet),
  chainId: ChainId.Mainnet,
  type: InfinityStakerContract
};

export const infinityStakerGoerliDesc: ContractDescription = {
  address: getStakerAddress(ChainId.Goerli),
  chainId: ChainId.Goerli,
  type: InfinityStakerContract
};
