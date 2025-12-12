/**
 * Extended Map with utility methods for managing collections
 */
export class Collection<K, V> extends Map<K, V> {
  /**
   * Get a random value from the collection
   */
  random(): V | undefined {
    const values = [...this.values()];
    return values[Math.floor(Math.random() * values.length)];
  }

  /**
   * Get a random key from the collection
   */
  randomKey(): K | undefined {
    const keys = [...this.keys()];
    return keys[Math.floor(Math.random() * keys.length)];
  }

  /**
   * Get first N values from the collection
   */
  first(count?: number): V | V[] | undefined {
    if (count === undefined) {
      return this.values().next().value;
    }
    if (count < 0) {
      return this.last(count * -1);
    }
    const values = [...this.values()];
    return values.slice(0, count);
  }

  /**
   * Get last N values from the collection
   */
  last(count?: number): V | V[] | undefined {
    const values = [...this.values()];
    if (count === undefined) {
      return values[values.length - 1];
    }
    if (count < 0) {
      return this.first(count * -1);
    }
    return values.slice(-count);
  }

  /**
   * Find a value by a predicate
   */
  find(fn: (value: V, key: K, collection: this) => boolean): V | undefined {
    for (const [key, value] of this) {
      if (fn(value, key, this)) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Find a key by a predicate
   */
  findKey(fn: (value: V, key: K, collection: this) => boolean): K | undefined {
    for (const [key, value] of this) {
      if (fn(value, key, this)) {
        return key;
      }
    }
    return undefined;
  }

  /**
   * Filter the collection by a predicate
   */
  filter(fn: (value: V, key: K, collection: this) => boolean): Collection<K, V> {
    const result = new Collection<K, V>();
    for (const [key, value] of this) {
      if (fn(value, key, this)) {
        result.set(key, value);
      }
    }
    return result;
  }

  /**
   * Map the collection to a new array
   */
  map<T>(fn: (value: V, key: K, collection: this) => T): T[] {
    const result: T[] = [];
    for (const [key, value] of this) {
      result.push(fn(value, key, this));
    }
    return result;
  }

  /**
   * Check if some values pass a predicate
   */
  some(fn: (value: V, key: K, collection: this) => boolean): boolean {
    for (const [key, value] of this) {
      if (fn(value, key, this)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if every value passes a predicate
   */
  every(fn: (value: V, key: K, collection: this) => boolean): boolean {
    for (const [key, value] of this) {
      if (!fn(value, key, this)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Reduce the collection to a single value
   */
  reduce<T>(fn: (acc: T, value: V, key: K, collection: this) => T, initial: T): T {
    let acc = initial;
    for (const [key, value] of this) {
      acc = fn(acc, value, key, this);
    }
    return acc;
  }

  /**
   * Partition the collection into two based on a predicate
   */
  partition(
    fn: (value: V, key: K, collection: this) => boolean
  ): [Collection<K, V>, Collection<K, V>] {
    const truthy = new Collection<K, V>();
    const falsy = new Collection<K, V>();
    for (const [key, value] of this) {
      if (fn(value, key, this)) {
        truthy.set(key, value);
      } else {
        falsy.set(key, value);
      }
    }
    return [truthy, falsy];
  }

  /**
   * Sort the collection
   */
  sort(fn?: (a: V, b: V, aKey: K, bKey: K) => number): this {
    const entries = [...this.entries()];
    entries.sort((a, b) => (fn ? fn(a[1], b[1], a[0], b[0]) : 0));
    this.clear();
    for (const [key, value] of entries) {
      this.set(key, value);
    }
    return this;
  }

  /**
   * Clone the collection
   */
  clone(): Collection<K, V> {
    return new Collection(this);
  }

  /**
   * Merge collections together
   */
  concat(...collections: Collection<K, V>[]): Collection<K, V> {
    const result = this.clone();
    for (const collection of collections) {
      for (const [key, value] of collection) {
        result.set(key, value);
      }
    }
    return result;
  }

  /**
   * Convert to array of values
   */
  toArray(): V[] {
    return [...this.values()];
  }

  /**
   * Convert to array of keys
   */
  toKeyArray(): K[] {
    return [...this.keys()];
  }

  /**
   * Create collection from array
   */
  static from<K, V>(
    iterable: Iterable<readonly [K, V]> | ArrayLike<readonly [K, V]>
  ): Collection<K, V> {
    return new Collection(Array.from(iterable));
  }
}
