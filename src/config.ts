import { ChainId } from '@infinityxyz/lib/types/core';
import { getExchangeAddress, getStakerAddress } from '@infinityxyz/lib/utils';
import {
  ETHEREUM_STAKER_CONTRACT_ADDRESS,
  ETHEREUM_STAKER_CONTRACT_ADDRESS_TEST
} from '@infinityxyz/lib/utils/constants';
import { InfinityExchangeContract } from './models/contracts/infinity-exchange.contract';
import { InfinityStakerContract } from './models/contracts/infinity-staker.contract';
import { ContractDescription } from './models/contracts/types';

export const infinityExchangeMainnetDesc: ContractDescription = {
  address: getExchangeAddress(ChainId.Mainnet),
  chainId: ChainId.Mainnet,
  type: InfinityExchangeContract
};

export const infinityStakerMainnetDescTest: ContractDescription = {
  address: ETHEREUM_STAKER_CONTRACT_ADDRESS_TEST,
  chainId: ChainId.Mainnet,
  type: InfinityStakerContract
};

export const infinityStakerMainnetDesc: ContractDescription = {
  address: ETHEREUM_STAKER_CONTRACT_ADDRESS,
  chainId: ChainId.Mainnet,
  type: InfinityStakerContract
};

export const infinityStakerGoerliDesc: ContractDescription = {
  address: getStakerAddress(ChainId.Goerli),
  chainId: ChainId.Goerli,
  type: InfinityStakerContract
};
