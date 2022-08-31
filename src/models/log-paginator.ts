/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-console */
import { sleep } from '@infinityxyz/lib/utils';
import { ethers } from 'ethers';
import { Readable } from 'stream';
import { MAX_UNCLE_ABLE_BLOCKS } from '../constants';

import {
  EthersJsonRpcRequest,
  HistoricalLogs,
  HistoricalLogsChunk,
  JsonRpcError,
  PaginateLogsOptions,
  ThunkedLogRequest
} from './log-paginator.types';

export class LogPaginator {
  constructor(private optimizeAfterXEmptyRequests = 5) {}

  /**
   * paginateLogs handles paginating a log request over any number of blocks
   *
   * note: we are limited to requesting 2k blocks at a time
   *
   * toBlock will default to latest if not specified
   */
  async paginateLogs(
    thunkedLogRequest: ThunkedLogRequest,
    provider: ethers.providers.Provider,
    options: PaginateLogsOptions
  ): Promise<HistoricalLogs> {
    // eslint-disable-next-line prefer-const
    let { fromBlock, toBlock = 'latest', maxAttempts = 5, returnType = 'stream' } = options;

    toBlock = toBlock ?? 'latest';

    const getMaxBlock = async (provider: ethers.providers.Provider, toBlock: number | 'latest'): Promise<number> => {
      let maxBlock: number;
      if (typeof toBlock === 'string') {
        try {
          maxBlock = (await provider.getBlockNumber()) - MAX_UNCLE_ABLE_BLOCKS;
        } catch (err) {
          console.error('failed to get current block number', err);
          throw new Error('failed to get current block number');
        }
      } else {
        maxBlock = toBlock;
      }
      return maxBlock;
    };

    const maxBlock = await getMaxBlock(provider, toBlock);
    const generator = this.paginateLogsHelper(thunkedLogRequest, fromBlock, maxBlock, maxAttempts);
    let readable: Readable;
    let events: ethers.Event[] = [];
    switch (returnType) {
      case 'stream':
        readable = Readable.from(generator);
        return readable;
      case 'generator':
        return generator;
      case 'promise':
        readable = Readable.from(generator);
        for await (const data of readable) {
          events = [...events, ...((data ?? []) as ethers.Event[])];
        }
        return events;
    }
  }

  private *paginateLogsHelper(
    thunkedLogRequest: ThunkedLogRequest,
    minBlock: number,
    maxBlock: number,
    maxAttempts: number
  ): Generator<Promise<HistoricalLogsChunk>, void, unknown> {
    const defaultPageSize = 500;
    const blockRange = {
      maxBlock,
      minBlock,
      from: minBlock,
      to: minBlock + defaultPageSize,
      pageSize: defaultPageSize,
      maxPageSize: defaultPageSize
    };

    const errorHandler = this.ethersErrorHandler<HistoricalLogsChunk>(maxAttempts, 1000, blockRange);

    let pagesWithoutResults = 0;
    while (blockRange.from < blockRange.maxBlock) {
      yield errorHandler(async () => {
        // we can get a max of 2k blocks at once
        blockRange.to = blockRange.from + blockRange.pageSize;

        if (blockRange.to > blockRange.maxBlock) {
          blockRange.to = maxBlock;
        }
        const size = maxBlock - minBlock;
        const progress = Math.floor(((blockRange.from - blockRange.minBlock) / size) * 100 * 100) / 100;

        if (pagesWithoutResults > this.optimizeAfterXEmptyRequests) {
          try {
            const events = await thunkedLogRequest(blockRange.from, blockRange.maxBlock);
            const fromBlock = blockRange.minBlock;
            const toBlock = blockRange.to;
            blockRange.to = blockRange.maxBlock;
            return {
              progress,
              fromBlock,
              toBlock,
              events
            };
          } catch (err) {
            console.error('Failed to optimize logs query', err);
            pagesWithoutResults = 0;
          }
        }

        const from = blockRange.from;
        const to = from === 0 && blockRange.pageSize <= defaultPageSize ? blockRange.maxBlock : blockRange.to;
        const events = await thunkedLogRequest(from, to);

        if (events.length === 0) {
          pagesWithoutResults += 1;
        } else {
          pagesWithoutResults = 0;
        }

        const fromBlock = blockRange.minBlock;
        const toBlock = blockRange.to;
        return {
          progress,
          fromBlock,
          toBlock,
          events
        };
      });

      blockRange.from = blockRange.to + 1;
    }
  }

  private ethersErrorHandler<Response>(
    maxAttempts = 5,
    retryDelay = 1000,
    blockRange?: { pageSize: number; from: number }
  ): (request: EthersJsonRpcRequest<Response>) => Promise<Response> {
    return async (request: EthersJsonRpcRequest<Response>): Promise<Response> => {
      const attempt = async (attempts = 0): Promise<Response> => {
        attempts += 1;
        try {
          const res = await request();
          return res;
        } catch (err: any) {
          console.error('Failed ethers request', err);
          if (attempts > maxAttempts) {
            throw err;
          }

          if ('code' in err) {
            switch (err.code as unknown as JsonRpcError | string) {
              case JsonRpcError.RateLimit:
                await sleep(retryDelay);
                return await attempt(attempts);

              case JsonRpcError.ParseError:
                return await attempt(attempts);

              case JsonRpcError.InvalidRequest:
                throw err;

              case JsonRpcError.MethodNotFound:
                throw err;

              case JsonRpcError.InvalidParams:
                throw err;

              case JsonRpcError.InternalError:
                return await attempt(attempts);

              case JsonRpcError.ServerError:
                await sleep(retryDelay);
                return await attempt(attempts);

              case 'ETIMEDOUT':
                await sleep(retryDelay);
                return await attempt(attempts);

              case 'SERVER_ERROR':
                if (
                  'body' in err &&
                  typeof err.body === 'string' &&
                  (err.body as string).includes('Consider reducing your block range')
                ) {
                  if (blockRange) {
                    blockRange.pageSize = Math.floor(blockRange.pageSize / 2);
                    console.log(`\n\n Reducing block range to: ${blockRange.pageSize} \n\n`);
                    return await attempt(attempts);
                  }
                } else if (
                  typeof err.body === 'string' &&
                  (err.body as string).includes('this block range should work')
                ) {
                  if (blockRange) {
                    const regex = /\[(\w*), (\w*)]/;
                    const matches = ((JSON.parse(err.body as string)?.error?.message ?? '') as string).match(regex);
                    const validMinBlockHex = matches?.[1];
                    const validMaxBlockHex = matches?.[2];

                    if (validMinBlockHex && validMaxBlockHex) {
                      const validMinBlock = parseInt(validMinBlockHex, 16);
                      const validMaxBlock = parseInt(validMaxBlockHex, 16);
                      const range = validMaxBlock - validMinBlock;
                      blockRange.from = validMinBlock;
                      blockRange.pageSize = range;
                      console.log(
                        `\n\n Reducing block range to recommended range: ${blockRange.from} - ${
                          blockRange.from + blockRange.pageSize
                        }. \n\n`
                      );
                    }
                  }
                }
                await sleep(retryDelay);
                return await attempt(attempts);

              case 'TIMEOUT':
                await sleep(retryDelay);
                return await attempt(attempts);

              default:
                console.log(`Encountered unknown error code ${err?.code}`);
                throw err;
            }
          }

          console.log('failed to get code from ethers error');
          console.log(err);

          return await attempt(attempts);
        }
      };

      const response = await attempt();
      return response;
    };
  }
}
