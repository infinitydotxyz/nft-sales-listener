export default class Logger {
    private readonly errorLogger?;
    constructor();
    log(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
    registerProcessListeners(): void;
}
