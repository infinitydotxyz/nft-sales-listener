import { ethers } from 'ethers';
import { ContractListener, ContractListenerEvent } from 'v2/contract-listeners/contract-listener.abstract';
import { BlockProvider } from 'v2/models/block-provider';

export abstract class Contract {
  protected contract: ethers.Contract;
  protected abstract _listeners: ContractListener<any>[];

  constructor(
    address: string,
    provider: ethers.providers.StaticJsonRpcProvider,
    abi: ethers.ContractInterface,
    protected blockProvider: BlockProvider
  ) {
    this.contract = new ethers.Contract(address, abi, provider);
  }

  private _off?: () => void;

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

  public async backfill(fromBlock: number, toBlock?: number) {
    const off = this.registerListeners(ContractListenerEvent.BackfillEvent);

    const promises = this._listeners.map((item) => item.backfill(fromBlock, toBlock));

    await Promise.all(promises);
    off();
  }

  protected abstract registerListeners(event: ContractListenerEvent): () => void;
}
