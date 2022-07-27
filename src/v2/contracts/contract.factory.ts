import Firebase from 'database/Firebase';
import Providers from 'models/Providers';
import { EventHandler } from 'v2/event-handlers/types';
import { TransactionReceiptProvider } from 'v2/models/transaction-receipt-provider';
import { ContractDescription, ContractType } from './types';

export class ContractFactory {
  constructor(private _providers: Providers, protected firebase: Firebase) {}

  create(desc: ContractDescription, handler: EventHandler, txReceiptProvider: TransactionReceiptProvider): ContractType {
    const { address, chainId, type } = desc;
    const provider = this._providers.getProviderByChainId(chainId);
    const blockProvider = this._providers.getBlockProviderByChainId(chainId);
    const contract = new type(
      provider,
      address,
      blockProvider,
      type.listenerConstructors as any[],
      chainId,
      this.firebase,
      txReceiptProvider,
      handler
    );
    return contract;
  }
}
