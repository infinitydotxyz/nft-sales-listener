import { Contract, ethers } from 'ethers';
import { BlockProvider } from 'v2/models/block-provider';
import { HistoricalLogsChunk } from 'v2/models/log-paginator.types';
import { TransactionReceiptProvider } from 'v2/models/transaction-receipt-provider';
import { ContractListener, ContractListenerEvent, Events } from './contract-listener.abstract';


export abstract class ContractListenerBundle<
  DecodedLogs extends { blockNumber: number },
  DecodedLog extends { blockNumber: number }
> extends ContractListener<DecodedLog, Events<DecodedLogs>> {
  protected abstract decodeLogs(logs: ethers.providers.Log[]): Promise<DecodedLogs | null>;
  protected abstract decodeSingleLog(log: ethers.providers.Log): Promise<DecodedLog | null> | DecodedLog | null;

  constructor(contract: Contract, blockProvider: BlockProvider, protected txReceiptProvider: TransactionReceiptProvider) {
    super(contract, blockProvider);
  }

  protected decodeLog(): Promise<DecodedLog | null> {
    throw new Error('Contract listener bundles should implement decodeLogs');
  }

  async backfill(fromBlock: number, toBlock?: number) {
    const events = (await this._logPaginator.paginateLogs(this._thunkedLogRequest, this._contract.provider, {
      fromBlock,
      toBlock: toBlock ?? 'latest',
      returnType: 'generator'
    })) as Generator<Promise<HistoricalLogsChunk>, void, unknown>;
    let updatedToBlock = fromBlock;
    for await (const chunk of events) {
      for (const event of chunk.events) {
        try {
          const tx = await this.txReceiptProvider.getReceipt(event.transactionHash);
          const logs = tx.logs.filter((log) => {
            return log.topics.every((topic, index) => {
              const correspondingTopic = this._eventFilter.topics?.[index];
              return !correspondingTopic || topic === correspondingTopic;
            });
          });
          const decoded = await this.decodeLogs(logs);
          if (decoded != null) {
            if (decoded.blockNumber > updatedToBlock) {
              updatedToBlock = decoded.blockNumber;
            }
            this._eventEmitter._emit(ContractListenerEvent.BackfillEvent, decoded);
          }
        } catch (err) {
          console.error(`Failed to decode log `, err);
        }
      }
    }
    return { highestBlockReached: updatedToBlock, fromBlock, name: this.eventName };
  }

  protected _start() {
    const handler = async (...args: ethers.Event[]) => {
      const arg = args[args.length - 1];
      if (arg?.transactionHash) {
        const tx = await this.txReceiptProvider.getReceipt(arg.transactionHash);
        const logs = tx.logs.filter((log) => {
          return log.topics.every((topic, index) => {
            const correspondingTopic = this._eventFilter.topics?.[index];
            return !correspondingTopic || topic === correspondingTopic;
          });
        });
        const decoded = await this.decodeLogs(logs);
        if (decoded != null) {
          this._eventEmitter._emit(ContractListenerEvent.EventOccurred, decoded);
        }
      }
    };
    this._contract.on(this._eventFilter, handler);
    return () => {
      this._contract.off(this._eventFilter, handler);
    };
  }
}
