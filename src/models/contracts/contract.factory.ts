/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Firebase } from '../../database/Firebase';
import { Providers } from '../providers';
import { EventHandler } from '../event-handlers/types';
import { ProtocolFeeProvider } from '../protocol-fee-provider';
import { TransactionReceiptProvider } from '../transaction-receipt-provider';
import { InfinityExchangeContract } from './infinity-exchange.contract';
import { OpenSeaContract } from './opensea.contract';
import { SeaportContract } from './seaport.contract';
import { ContractDescription, Contracts, ContractType } from './types';
import { InfinityStakerContract } from './infinity-staker.contract';

export class ContractFactory {
  constructor(private _providers: Providers, protected firebase: Firebase) {}

  create(
    desc: ContractDescription,
    handler: EventHandler,
    txReceiptProvider: TransactionReceiptProvider,
    protocolFeeProvider: ProtocolFeeProvider
  ): ContractType {
    const { address, chainId, type } = desc;
    const provider = this._providers.getProviderByChainId(chainId);
    const blockProvider = this._providers.getBlockProviderByChainId(chainId);
    console.log(`Creating contract ${type.discriminator} at ${address}`);
    switch (type.discriminator) {
      case Contracts.InfinityExchange:
        return new InfinityExchangeContract(
          provider,
          address,
          blockProvider,
          InfinityExchangeContract.listenerConstructors,
          chainId,
          this.firebase,
          txReceiptProvider,
          protocolFeeProvider,
          handler,
          desc.numBlocksToBackfill
        );
      case Contracts.Seaport:
        return new SeaportContract(
          provider,
          address,
          blockProvider,
          SeaportContract.listenerConstructors,
          chainId,
          this.firebase,
          txReceiptProvider,
          handler,
          desc.numBlocksToBackfill
        );
      case Contracts.OpenSea:
        return new OpenSeaContract(
          provider,
          address,
          blockProvider,
          OpenSeaContract.listenerConstructors,
          chainId,
          this.firebase,
          txReceiptProvider,
          handler,
          desc.numBlocksToBackfill
        );
      case Contracts.InfinityStaker:
        return new InfinityStakerContract(
          provider,
          address,
          blockProvider,
          InfinityStakerContract.listenerConstructors,
          chainId,
          this.firebase,
          handler,
          desc.numBlocksToBackfill
        );

      default:
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(`Unknown contract type: ${(type as any)?.discriminator}`);
    }
  }
}
