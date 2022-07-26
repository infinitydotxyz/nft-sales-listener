import { ethers } from 'ethers';
import { Contract } from 'ethers/lib/ethers';
import EventEmitter from 'events';
import { BlockProvider } from '../models/block-provider';
import { LogPaginator } from '../models/log-paginator';
import { HistoricalLogsChunk } from '../models/log-paginator.types';

export enum ContractListenerEvent {
  EventOccurred = 'eventOccurred',
  BackfillEvent = 'backfillEvent'
}

export interface Events<T> {
  [ContractListenerEvent.EventOccurred]: T;
  [ContractListenerEvent.BackfillEvent]: T;
}

export abstract class ContractListener<DecodedLogType> {
  protected _eventEmitter: EventEmitter;
  protected _logPaginator: LogPaginator;
  protected _cancelListener?: () => void;

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

    for await (const chunk of events) {
      for (const event of chunk.events) {
        const decoded = await this.decodeLog([event]);
        if (decoded != null) {
          this._emit(ContractListenerEvent.BackfillEvent, decoded);
        }
      }
    }
  }

  on<Event extends ContractListenerEvent>(
    event: ContractListenerEvent,
    handler: (e: Events<DecodedLogType>[Event]) => void
  ): () => void {
    this._eventEmitter.on(event, handler);
    return () => {
      this._eventEmitter.off(event, handler);
    };
  }

  off<Event extends ContractListenerEvent>(
    event: ContractListenerEvent,
    handler: (e: Events<DecodedLogType>[Event]) => void
  ): void {
    this._eventEmitter.off(event, handler);
  }

  protected _emit<Event extends keyof Events<DecodedLogType>>(event: Event, data: Events<DecodedLogType>[Event]): void {
    this._eventEmitter.emit(event as string, data);
  }

  private _start() {
    const handler = async (...args: ethers.Event[]) => {
      const decoded = await this.decodeLog(args);
      if (decoded != null) {
        this._emit(ContractListenerEvent.EventOccurred, decoded);
      }
    };
    this._contract.on(this._eventFilter, handler);
    return () => {
      this._contract.off(this._eventFilter, handler);
    };
  }
}
