/// <reference types="react" />
import * as React from 'react';
export declare class StorePersistantLocalSrorageDriver<StoreState> implements StorePersistantDriver<StoreState> {
    readonly name: string;
    readonly lifetime: number;
    private storage;
    constructor(name: string, lifetime?: number);
    private readonly storeName;
    write(state: StoreState): void;
    read(): StoreState;
}
export declare abstract class StorePersistantDriver<StoreState> {
    readonly name: string;
    readonly lifetime: number;
    constructor(name: string, lifetime?: number);
    abstract write(state: StoreState): void;
    abstract read(): StoreState;
}
export declare abstract class StoreComponent<Props, State, StoreState> extends React.Component<Props, State> {
    stores: StoreState;
    private isStoreMounted;
    storeComponentDidMount(): void;
    storeComponentWillUnmount(): void;
    storeComponentWillReceiveProps(nextProps: Props): void;
    storeComponentWillUpdate(nextProps: Props, nextState: State): void;
    storeComponentDidUpdate(prevProps: Props, prevState: State): void;
    shouldStoreComponentUpdate(nextProps: Props, nextState: State): boolean;
    storeComponentStoreWillUpdate(): void;
    storeComponentStoreDidUpdate(): void;
    constructor(stores: StoreState);
    componentDidMount(): void;
    componentWillUnmount(): void;
    componentWillReceiveProps(nextProps: Props): void;
    componentWillUpdate(nextProps: Props, nextState: State): void;
    componentDidUpdate(prevProps: Props, prevState: State): void;
    shouldComponentUpdate(nextProps: Props, nextState: State): boolean;
}
export interface StoreOptions {
    live?: boolean;
    freezeInstances?: boolean;
    mutable?: boolean;
}
export declare class Store<StoreState> {
    readonly persistenceDriver: StorePersistantDriver<StoreState>;
    components: any[];
    private eventManager;
    private readonly frozenState;
    private readonly initialState;
    constructor(state: StoreState, options?: StoreOptions, persistenceDriver?: StorePersistantDriver<StoreState>);
    readonly state: StoreState;
    resetPersistence(): void;
    setState(newState: Partial<StoreState>): void;
    resetState(): void;
    update(currentState: StoreState, prevState: StoreState): void;
    getInitialState(): StoreState;
    on(eventType: StoreEventType | StoreEventType[], callback: (storeState: StoreState, prevState?: StoreState, type?: StoreEventType) => void): StoreEvent<StoreState>;
}
export declare type StoreEventType = 'all' | 'init' | 'update';
export declare class StoreEvent<StoreState> {
    readonly id: string;
    readonly types: StoreEventType[];
    readonly onFire: (storeState: StoreState, prevState?: StoreState, type?: StoreEventType) => void;
    readonly onRemove: (id: string) => void;
    constructor(id: string, types: StoreEventType[], onFire: (storeState: StoreState, prevState?: StoreState, type?: StoreEventType) => void, onRemove: (id: string) => void);
    remove(): void;
}
export declare const followStore: <StoreState>(store: Store<StoreState>, followStates?: string[]) => (WrappedComponent: React.ComponentClass<{}>) => any;
