import Providers from 'models/Providers';
import { ContractDescription, ContractType } from './types';

export class ContractFactory {
  constructor(private _providers: Providers) {}

  create(desc: ContractDescription): ContractType {
    const { address, chainId, type } = desc;
    const provider = this._providers.getProviderByChainId(chainId);
    const blockProvider = this._providers.getBlockProviderByChainId(chainId);
    const contract = new type(provider, address, blockProvider, type.listenerConstructors as any[]);
    return contract;
  }
}
