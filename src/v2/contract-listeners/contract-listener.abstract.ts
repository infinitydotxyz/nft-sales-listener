
import { ethers } from 'ethers';
import { Contract } from 'ethers/lib/ethers';
import { Event, EventEmitter } from 'v2/models/event-emitter';
import { BlockProvider } from '../models/block-provider';
import { LogPaginator } from '../models/log-paginator';
import { HistoricalLogsChunk } from '../models/log-paginator.types';

export enum ContractListenerEvent {
  EventOccurred = 'eventOccurred',
  BackfillEvent = 'backfillEvent',

}

export interface Events<T> {
  [ContractListenerEvent.EventOccurred]: T;
  [ContractListenerEvent.BackfillEvent]: T;
}

export abstract class ContractListener<DecodedLogType extends { blockNumber: number }, EventTypes extends Record<ContractListenerEvent, any>> {
  protected _eventEmitter: EventEmitter<EventTypes> = new EventEmitter();
  protected _logPaginator: LogPaginator;
  protected _cancelListener?: () => void;

  public on<E extends Event<EventTypes>>(event: E, handler: (e: EventTypes[E]) => void) {
    const off = this._eventEmitter.on(event, handler);
    return () => {
      off();
    }
  }

  public off<E extends Event<EventTypes>>(event: E, handler: (e: EventTypes[E]) => void) {
    this._eventEmitter.off(event, handler);
  }

  /**
   * identifier for the event
   */
  public abstract readonly eventName: string;
  protected abstract _eventFilter: ethers.EventFilter;

  protected get _thunkedLogRequest() {
    const queryFilter = this._contract.queryFilter.bind(this._contract);
    const thunkedLogRequest = async (fromBlock: number, toBlock: number | 'latest'): Promise<ethers.Event[]> => {
      return await queryFilter(this._eventFilter, fromBlock, toBlock);
    };
    return thunkedLogRequest;
  }

  constructor(protected _contract: Contract, protected _blockProvider: BlockProvider) {
    this._eventEmitter = new EventEmitter();
    this._logPaginator = new LogPaginator();
  }

  protected abstract decodeLog(args: ethers.Event[]): Promise<DecodedLogType | null> | DecodedLogType | null;

  start() {
    if (!this._cancelListener) {
      this._cancelListener = this._start();
    }
  }

  stop() {
    this._cancelListener?.();
    this._cancelListener = undefined;
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
          const decoded = await this.decodeLog([event]);
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
      const decoded = await this.decodeLog(args);
      if (decoded != null) {
        this._eventEmitter._emit(ContractListenerEvent.EventOccurred, decoded);
      }
    };
    this._contract.on(this._eventFilter, handler);
    return () => {
      this._contract.off(this._eventFilter, handler);
    };
  }
}
