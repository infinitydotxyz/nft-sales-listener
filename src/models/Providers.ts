import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { ChainId } from '@infinityxyz/lib/types/core';
import { JSON_RPC_GOERLI_KEYS, JSON_RPC_MAINNET_KEYS } from '../constants';
import { BlockProvider } from './block-provider';
import { randomItem } from '../utils';

export class Providers {
  private readonly providers: Record<ChainId, StaticJsonRpcProvider[]>;
  private readonly blockProviders: Record<ChainId, BlockProvider | undefined>;

  constructor() {
    const mainnetProviders = JSON_RPC_MAINNET_KEYS.map((item) => {
      return new StaticJsonRpcProvider(item);
    });
    const goerliProviders = JSON_RPC_GOERLI_KEYS.map((item) => {
      return new StaticJsonRpcProvider(item);
    });

    const mainnetBlockProvider = mainnetProviders[0] ? new BlockProvider(50, mainnetProviders[0]) : undefined;
    const goerliBlockProvider = goerliProviders[0] ? new BlockProvider(50, goerliProviders[0]) : undefined;

    this.providers = {
      [ChainId.Mainnet]: mainnetProviders,
      [ChainId.Goerli]: goerliProviders,
      [ChainId.Polygon]: []
    };
    this.blockProviders = {
      [ChainId.Mainnet]: mainnetBlockProvider,
      [ChainId.Goerli]: goerliBlockProvider,
      [ChainId.Polygon]: undefined
    };
  }

  getProviderByChainId(chainId: string): StaticJsonRpcProvider {
    const chainIdProviders = this.providers[chainId as ChainId];
    if (!chainIdProviders || chainIdProviders.length === 0) {
      throw new Error(`Provider not available for chain id: ${chainId}`);
    }
    const provider = randomItem(chainIdProviders);
    return provider;
  }

  getBlockProviderByChainId(chainId: ChainId): BlockProvider {
    const blockProvider = this.blockProviders[chainId];
    if (!blockProvider) {
      throw new Error(`Block provider not available for chain id: ${chainId}`);
    }
    return blockProvider;
  }
}
