import { ethers } from "ethers";
import { Readable } from "stream";


export enum JsonRpcError {
  RateLimit = 429,
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerError = -32000
}

export type EthersJsonRpcRequest<Response> = () => Promise<Response>;

export interface LogRequestOptions {
  fromBlock?: number;
  toBlock?: number;
}

export type LogRequest = (address: string, chainId: string, options?: LogRequestOptions) => ethers.Event[];

export type ThunkedLogRequest = (fromBlock: number, toBlock: number) => Promise<ethers.Event[]>;

export interface PaginateLogsOptions {
  fromBlock: number;
  toBlock?: number | 'latest';
  maxAttempts?: number;

  /**
   * stream return type should be used for getting events as fast as
   * possible and handling events as they are available
   *
   * generator should be used to lazily request events
   *
   * promise should be used to get all events at once
   */
  returnType?: 'stream' | 'generator' | 'promise';
}


export interface HistoricalLogsChunk {
  events: ethers.Event[];
  fromBlock: number;
  toBlock: number;
  progress: number;
}
export type HistoricalLogs = Readable | ethers.Event[] | Generator<Promise<HistoricalLogsChunk>, void, unknown>;

export interface HistoricalLogsOptions {
  fromBlock?: number;
  toBlock?: number | 'latest';
  returnType?: 'stream' | 'promise' | 'generator';
}
