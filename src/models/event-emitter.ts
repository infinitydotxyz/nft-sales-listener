import Emitter from 'events';

export type StringKey<T> = keyof T & string;
export type Event<EventType> = StringKey<EventType>;

export class EventEmitter<EventTypes extends Record<string, any>> {
  private _eventEmitter = new Emitter();

  on<E extends Event<EventTypes>>(event: E, handler: (e: EventTypes[E]) => void): () => void {
    this._eventEmitter.on(event, handler);
    return () => {
      this._eventEmitter.off(event, handler);
    };
  }

  off<E extends Event<EventTypes>>(event: E, handler: (e: EventTypes[E]) => void): void {
    this._eventEmitter.off(event, handler);
  }

  _emit<E extends Event<EventTypes>>(event: E, data: EventTypes[E]): void {
    this._eventEmitter.emit(event as string, data);
  }
}
