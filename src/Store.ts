import { StorePersistentDriver } from './StorePersistentDriver';
import { StorePersistentLocalStorageDriver } from './StorePersistentLocalStorageDriver';
import { StoreEventManager } from './StoreEventManager';
import {
  StoreEventType,
  StoreEvent,
  TOnFire,
  TOnFireWithKeys,
  StoreEventSpecificKeys,
  TStoreEvent,
} from './StoreEvent';

export interface StoreOptions {
  /**
   * @deprecated since 3.x: use immutable flag instead
   */
  live?: boolean;
  /**
   * @deprecated since 3.x: use immutable flag instead
   */
  freezeInstances?: boolean;
  immutable?: boolean;
  persistence?: boolean;
  setStateTimeout?: number;
  uniqKey?: string;
}

export class Store<StoreState> {
  public components = [];
  public readonly id: string;
  private eventManager: StoreEventManager<StoreState> | null = null;
  private readonly initialState: StoreState = null;
  private frozenState: StoreState = null;

  private opts: StoreOptions = {
    live: false,
    freezeInstances: false,
    immutable: false,
    persistence: false,
    setStateTimeout: 0,
    uniqKey: null,
  };

  get state(): StoreState {
    return this.frozenState;
  }

  private checkInitialStateType(initialState: StoreState): void {
    if (['number', 'boolean', 'string', 'undefined', 'symbol', 'bigint'].includes(typeof initialState)) {
      throw new Error('InitialState must be an object, passed: ' + typeof initialState);
    }
    if ([Array, Function, Map, Promise].some(item => initialState instanceof item)) {
      throw new Error('InitialState must be an object, passed: ' + initialState.constructor.name);
    }
  }

  constructor(
    initialState: StoreState,
    options?: StoreOptions,
    readonly persistenceDriver?: StorePersistentDriver<StoreState>,
  ) {
    this.checkInitialStateType(initialState);
    let currentState: StoreState | null = null;

    if (options) {
      this.opts.immutable = options.immutable === true;
      this.opts.persistence = options.persistence === true;
      this.opts.setStateTimeout = options.setStateTimeout;
      this.opts.uniqKey = options.uniqKey;
    }

    this.id = this.opts.uniqKey || this.generateStoreId(initialState);

    if (!this.persistenceDriver) {
      this.persistenceDriver = new StorePersistentLocalStorageDriver(this.id);
    }

    if (this.opts.persistence) {
      const persistentState = this.persistenceDriver.read().data;

      if (persistentState) {
        currentState = persistentState;
      }
    }

    if (currentState === null) {
      currentState = initialState;
    }

    this.persistenceDriver.persistence = this.opts.persistence;
    this.persistenceDriver.initialState = initialState;
    this.eventManager = new StoreEventManager(this.opts.setStateTimeout);
    this.initialState = this.deepFreeze(initialState);
    this.frozenState = this.deepFreeze(currentState);
  }

  deepFreeze(obj: any): any {
    if (this.opts.immutable) {
      const propNames = Object.getOwnPropertyNames(obj);

      for (const key in propNames) {
        if (propNames.hasOwnProperty(key)) {
          const prop = obj[propNames[key]];

          if (typeof prop === 'object' && prop !== null) {
            this.deepFreeze(prop);
          }
        }
      }

      return Object.freeze(obj);
    } else {
      return obj;
    }
  }

  private hashCode(str: string): string {
    let h = 0;

    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }

    return h.toString(16);
  }

  private generateStoreId(state: StoreState): string {
    let flatKeys: string = '';

    for (let key in state) {
      if (state.hasOwnProperty(key)) {
        flatKeys += key;
      }
    }

    return this.hashCode(flatKeys);
  }

  public resetPersistence() {
    this.persistenceDriver.reset();
  }

  public clearPersistence() {
    this.persistenceDriver.clear();
  }

  public resetDumpHistory() {
    this.persistenceDriver.resetHistory();
    this.eventManager.fire(StoreEventType.DumpUpdate, this.frozenState, this.frozenState);
  }

  public saveDump(): number {
    const timestamp = this.persistenceDriver.saveDump(this.persistenceDriver.pack(this.frozenState));
    this.eventManager.fire(StoreEventType.DumpUpdate, this.frozenState, this.frozenState);

    return timestamp;
  }

  public removeDump(timestamp: number) {
    this.persistenceDriver.removeDump(timestamp);
    this.eventManager.fire(StoreEventType.DumpUpdate, this.frozenState, this.frozenState);
  }

  public restoreDump(timestamp: number) {
    const pack = this.persistenceDriver.readDump(timestamp);

    if (pack) {
      const prevState = this.deepFreeze(this.frozenState);
      this.setState(pack.data);
      this.eventManager.fire(StoreEventType.DumpUpdate, this.frozenState, prevState);
    }
  }

  public getDumpHistory(): number[] {
    return this.persistenceDriver.getDumpHistory();
  }

  public setState(newState: Partial<StoreState>) {
    const prevState = this.deepFreeze(this.frozenState);
    const updatedState = this.deepFreeze({ ...prevState, ...newState });

    this.frozenState = updatedState;
    this.persistenceDriver.write(this.persistenceDriver.pack(updatedState));
    this.update(updatedState, prevState);
  }

  public resetState() {
    this.setState(this.deepFreeze(this.initialState));
  }

  public update(currentState: StoreState, prevState: StoreState) {
    for (const key in this.components) {
      if (this.components[key].isStoreMounted && this.components.hasOwnProperty(key)) {
        this.components[key].storeComponentStoreWillUpdate();
        this.components[key].forceUpdate();
        this.components[key].storeComponentStoreDidUpdate();
      }
    }

    this.eventManager.fire(StoreEventType.Update, currentState, prevState);
  }

  public getInitialState(): StoreState {
    return this.initialState;
  }

  // on overloads
  public on(
    eventType: StoreEventType | StoreEventType[],
    includeKeys: Array<keyof StoreState>,
    callback: TOnFireWithKeys<StoreState>,
  ): StoreEventSpecificKeys<StoreState>;
  public on(eventType: StoreEventType | StoreEventType[], callback: TOnFire<StoreState>): StoreEvent<StoreState>;
  public on(
    eventType: StoreEventType | StoreEventType[],
    secondArg: TOnFire<StoreState> | Array<keyof StoreState>,
    thirdArg?: TOnFireWithKeys<StoreState>,
  ): TStoreEvent<StoreState> {
    const eventTypes: StoreEventType[] =
      eventType && eventType.constructor === Array
        ? (eventType as StoreEventType[])
        : ([eventType] as StoreEventType[]);

    let event: StoreEvent<StoreState> | StoreEventSpecificKeys<StoreState>;

    if (Array.isArray(secondArg)) {
      event = this.eventManager.add(eventTypes, thirdArg, secondArg);
    } else {
      event = this.eventManager.add(eventTypes, secondArg);
    }

    this.eventManager.fire(StoreEventType.Init, this.frozenState, this.frozenState, event);
    this.eventManager.fire(StoreEventType.DumpUpdate, this.frozenState, this.frozenState, event);

    return event;
  }
}