import { ethers } from 'ethers';
import { ContractListener, ContractListenerEvent } from '../contract-listeners/contract-listener.abstract';
import { BlockProvider } from '../block-provider';
import { DbSyncedContractEvent } from './db-synced-contract.abstract';

export abstract class Contract {
  protected contract: ethers.Contract;
  protected abstract _listeners: ContractListener<any, any>[];

  constructor(
    address: string,
    provider: ethers.providers.StaticJsonRpcProvider,
    abi: ethers.ContractInterface,
    protected blockProvider: BlockProvider
  ) {
    this.contract = new ethers.Contract(address, abi, provider);
  }

  protected _off?: () => void;

  public start() {
    const off = this.registerListeners(ContractListenerEvent.EventOccurred);
    this._listeners.map((item) => item.start());

    this._off = () => {
      this._listeners.map((item) => item.stop());
      off();
    };
  }

  public stop() {
    if (this._off) {
      this._off();
      this._off = undefined;
    }
  }

  public async backfill(data: { [eventName: string]: DbSyncedContractEvent }) {
    const off = this.registerListeners(ContractListenerEvent.BackfillEvent);

    const promises = this._listeners.map(async (listener) => {
      const listenerData = data[listener.eventName];
      let fromBlock = listenerData?.lastBlockUpdated;
      if (typeof fromBlock !== 'number' || fromBlock < 0) {
        fromBlock = 0;
      }
      return listener.backfill(fromBlock);
    });

    const results = await Promise.all(promises);
    off();

    return results;
  }

  protected abstract registerListeners(event: ContractListenerEvent): () => void;
}
