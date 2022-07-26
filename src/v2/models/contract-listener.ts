import { ethers } from 'ethers';
import { Contract } from 'ethers/lib/ethers';
import EventEmitter from 'events';
import { BlockProvider } from './block-provider';
import { LogPaginator } from './log-paginator';
import { HistoricalLogsChunk } from './log-paginator.types';

export enum ContractListenerEvent {
    EventOccurred = 'eventOccurred',
}

export interface Events<T> {
    [ContractListenerEvent.EventOccurred]: T;
}

export abstract class ContractListener<DecodedLogType> {
  protected _eventEmitter: EventEmitter;
  protected _logPaginator: LogPaginator;
  protected _cancelListener?: () => void;

  protected get _thunkedLogRequest() {
    const queryFilter = this.contract.queryFilter.bind(this.contract);
    const thunkedLogRequest = async (fromBlock: number, toBlock: number | 'latest'): Promise<ethers.Event[]> => {
      return await queryFilter(this.eventFilter, fromBlock, toBlock);
    };
    return thunkedLogRequest;
  }

  constructor(
    protected contract: Contract,
    protected eventFilter: ethers.EventFilter,
    protected blockProvider: BlockProvider
  ) {
    this._eventEmitter = new EventEmitter();
    this._logPaginator = new LogPaginator();
  }

  start() {
    if(!this._cancelListener) {
        this._cancelListener = this._start();
    }
  }

  stop() {
    this._cancelListener?.();
  }

  private _start() {
    const handler = async (...args: ethers.Event[]) => {
        const decoded = await this.decodeLog(args);
        if(decoded != null) {
            this.emit(ContractListenerEvent.EventOccurred, decoded);
        }
    }
    this.contract.on(this.eventFilter, handler);
    return () => {
        this.contract.off(this.eventFilter, handler);
    }
  }

  async *backfill(fromBlock: number, toBlock?: number) {
    const events = (await this._logPaginator.paginateLogs(this._thunkedLogRequest, this.contract.provider, {
      fromBlock,
      toBlock: toBlock ?? 'latest',
      returnType: 'generator'
    })) as Generator<Promise<HistoricalLogsChunk>, void, unknown>;

    for await (const chunk of events) {
      for (const event of chunk.events) {
        const decoded = await this.decodeLog([event]);
        yield decoded;
      }
    }
  }

  protected abstract decodeLog(args: ethers.Event[]): Promise<DecodedLogType> | Promise<null> | DecodedLogType | null; 

  on<Event extends ContractListenerEvent>(event: ContractListenerEvent, handler: (e: Events<DecodedLogType>[Event]) => void): () => void {
    this._eventEmitter.on(event, handler);
    return () => {
      this._eventEmitter.off(event, handler);
    };
  }

  protected emit<Event extends keyof Events<DecodedLogType>>(event: Event, data: Events<DecodedLogType>[Event]): void {
    this._eventEmitter.emit(event as string, data);
  }
}
