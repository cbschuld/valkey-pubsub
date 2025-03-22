# @cbschuld/valkey-pubsub

A lightweight, TypeScript-native Pub/Sub implementation designed for use with [Mercurius GraphQL](https://github.com/mercurius-js/mercurius), built on top of Valkey (Redis-compatible).

Supports broadcasting messages to multiple listeners and enables easy event-driven design for GraphQL subscriptions or internal messaging systems.

---

## Features

- 🔁 **Broadcast-style delivery**: All listeners receive each message
- ⚡ **Fast and simple API**: Push, subscribe, destroy
- ✅ **Compatible with Mercurius** PubSub interface
- 🧪 **Tested with Jest**
- 🧱 **Type-safe and modular** — written in pure TypeScript

---

## Installation

```bash
pnpm add @cbschuld/valkey-pubsub
```

## Usage

### Create the PubSub instance

```typescript
import ValkeyPubSub, { PubSubGenericQueue } from "@cbschuld/valkey-pubsub";

const pubsub = await ValkeyPubSub.create({
  addresses: [{ host: "localhost", port: 6379 }],
  clusterMode: false,
});
```

### Subscribe to a topic

```typescript
const queue = new PubSubGenericQueue<string>();

await pubsub.subscribe("my-topic", queue);

queue.onItem((message) => {
  console.log("Received:", message);
});
```

### Publish a message

```typescript
await pubsub.publish({
  topic: "my-topic",
  payload: { hello: "world" },
});
```

## API

### ValkeyPubSub

#### `ValkeyPubSub.create(config): Promise<ValkeyPubSub>`

Creates a PubSub instance.

Config options:

- addresses: Array of { host, port } objects (defaults to Valkey on localhost:6379)
- protocol: 'RESP2' or 'RESP3' (default: 'RESP3')
- clusterMode: true or false (default: false)

#### `pubsub.subscribe(topic, queue)`

- Subscribes a queue to a topic. Every published message will be pushed to the queue and delivered to all its listeners.

#### `pubsub.publish({ topic, payload }, callback?)`

- Publishes a message to the specified topic. Payload will be stringified before being sent.

#### `pubsub.cleanup()`

- Cleans up all open connections and subscriptions.

### PubSubGenericQueue

#### `PubSubGenericQueue<T>`

A generic in-memory delivery queue that stores items and allows multiple listeners.

Methods:

- `push(value: T)`: Pushes a value onto the queue
- `onItem(callback: (value: T) => void)`: Registers a callback for new items
- `isEmpty()`: Returns true if the queue is empty
- `size()`: Returns the current number of pending items
- `destroy()`: Destroys the queue and runs any registered close callbacks

## License

MIT © Chris Schuld <cbschuld@gmail.com>
