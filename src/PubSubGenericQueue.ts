import { PubSubQueue } from "./ValkeyPubSub.js";

type QueueItem<T> = {
  value: T;
  deliveredTo: Set<(item: T) => void>;
};

class PubSubGenericQueue<T extends string | Buffer> implements PubSubQueue {
  private items: QueueItem<T>[] = [];
  private listeners: ((item: T) => void)[] = [];
  public close?: (() => Promise<void>)[];

  // Add item to queue
  push(value: T): void {
    const item: QueueItem<T> = {
      value,
      deliveredTo: new Set(),
    };
    this.items.push(item);
    this.notifyListeners();
  }

  // Register a listener for new items
  onItem(callback: (item: T) => void): void {
    this.listeners.push(callback);
    this.notifyListener(callback);
  }

  // Method to execute all close handlers
  async destroy(): Promise<void> {
    if (this.close) {
      await Promise.all(this.close.map((fn) => fn()));
    }
    this.items = [];
    this.listeners = [];
  }

  // Private method to notify all listeners
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      this.notifyListener(listener);
    }
  }

  // Private method to notify a specific listener
  private notifyListener(listener: (item: T) => void): void {
    for (const item of this.items) {
      if (!item.deliveredTo.has(listener)) {
        item.deliveredTo.add(listener);
        listener(item.value);
      }
    }
    this.items = this.items.filter(
      (item) => item.deliveredTo.size < this.listeners.length
    );
  }

  // Check if queue is empty
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  // Get current queue size
  size(): number {
    return this.items.length;
  }
}

export default PubSubGenericQueue;
