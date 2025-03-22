import {
  ClosingError,
  GlideClient,
  GlideClientConfiguration,
  GlideClusterClient,
  GlideClusterClientConfiguration,
  ProtocolVersion,
  PubSubMsg,
} from "@valkey/valkey-glide";

// Define a type for the configuration
interface ValkeyConfig {
  addresses?: { host: string; port?: number | undefined }[];
  protocol?: ProtocolVersion; // 'RESP2' | 'RESP3';
  clusterMode?: boolean;
}

// Define the expected queue interface
export interface PubSubQueue {
  push(value: any): void;
  close?: (() => Promise<void>)[];
}

// Define a type for subscription information
interface Subscription {
  queue: PubSubQueue;
}

class ValkeyPubSub {
  private baseConfig:
    | GlideClientConfiguration
    | GlideClusterClientConfiguration;
  private clients: Map<string, GlideClient | GlideClusterClient>;
  private subscriptions: Map<string, Subscription[]>;
  private publishClient: GlideClient | GlideClusterClient | undefined =
    undefined;
  private clusterMode: boolean;
  private subscribing = new Set<string>();

  constructor(config: ValkeyConfig = {}) {
    // Default configuration for Valkey connection
    this.baseConfig = {
      addresses: config.addresses || [{ host: "valkey", port: 6379 }],
      protocol: (config.protocol || "RESP3") as ProtocolVersion, // Ensure RESP3 for PubSub support
    };
    this.clusterMode = config.clusterMode || false;

    // Map to store topic-specific Glide clients
    this.clients = new Map();

    // Map to store multiple subscriptions (queues) per topic
    this.subscriptions = new Map();
  }

  // Static async factory method for creating an instance
  public static async create(config: ValkeyConfig = {}): Promise<ValkeyPubSub> {
    const instance = new ValkeyPubSub(config);

    // Perform asynchronous initialization
    try {
      instance.publishClient = config.clusterMode
        ? await GlideClusterClient.createClient(
            instance.baseConfig as GlideClusterClientConfiguration
          )
        : await GlideClient.createClient(
            instance.baseConfig as GlideClientConfiguration
          );
    } catch (error) {
      throw new Error(`Failed to initialize publish client: ${error}`);
    }
    return instance;
  }

  async subscribe(topic: string, queue: PubSubQueue): Promise<void> {
    if (this.subscribing.has(topic)) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simple backoff
      return this.subscribe(topic, queue);
    }

    this.subscribing.add(topic);

    try {
      // If this is the first subscription for the topic, create a new Glide client
      if (!this.clients.has(topic)) {
        const subscriptionConfig = {
          channelsAndPatterns: {
            Exact: new Set([topic]),
          },
          // No callback, we'll use async methods
        };

        const clientConfig = {
          ...this.baseConfig,
          pubsubSubscriptions: subscriptionConfig,
        };

        const client = this.clusterMode
          ? await GlideClusterClient.createClient(
              clientConfig as GlideClusterClientConfiguration
            )
          : await GlideClient.createClient(
              clientConfig as GlideClientConfiguration
            );

        this.clients.set(topic, client);
        this.subscriptions.set(topic, []);

        // Start listening for messages
        this.startListener(topic, client);
      }

      // Add the queue to the list of subscriptions for this topic
      const subscriptions = this.subscriptions.get(topic)!;

      // Close method to remove this specific queue
      const close = async () => {
        const topicSubscriptions = this.subscriptions.get(topic);
        if (topicSubscriptions) {
          const index = topicSubscriptions.findIndex(
            (sub) => sub.queue === queue
          );
          if (index !== -1) {
            topicSubscriptions.splice(index, 1);
          }

          // If no more subscriptions for this topic, clean up the client
          if (topicSubscriptions.length === 0) {
            const client = this.clients.get(topic);
            if (client) {
              client.close();
            }
            this.clients.delete(topic);
            this.subscriptions.delete(topic);
          }
        }
      };
      if (!queue.close) {
        queue.close = [];
      }
      queue.close.push(close);
      subscriptions.push({ queue });
    } finally {
      this.subscribing.delete(topic);
    }
  }

  private async startListener(
    topic: string,
    client: GlideClient | GlideClusterClient
  ): Promise<void> {
    let retryCount = 0;
    const maxRetries = 3;
    while (this.clients.has(topic)) {
      try {
        const message: PubSubMsg | null = await client.getPubSubMessage();
        if (message && message.channel === topic) {
          const subscriptions = this.subscriptions.get(topic);
          if (subscriptions) {
            // Push the message to all queues for this topic
            for (const { queue } of subscriptions) {
              const msg = message.message.toString();
              queue.push(msg);
            }
          }
        }
      } catch (error) {
        if (error instanceof ClosingError) {
          console.error("ClosingError: Closing the listener");
          break;
        } else {
          console.error(`Error receiving message for topic ${topic}:`, {
            error,
          });
          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * retryCount)
            );
            continue;
          }
          break; // Exit after max retries
        }
      }
    }
  }

  async publish(
    event: { topic: string; payload: any },
    callback: ((error?: Error) => void) | null = null
  ): Promise<void> {
    try {
      const receivedMessageCount = await this.publishClient?.publish(
        JSON.stringify(event.payload),
        event.topic
      );
      if (callback) {
        callback();
      }
    } catch (error) {
      console.error("Error publishing message:", error);
      if (callback) {
        callback(error as Error);
      }
    }
  }

  cleanup(): void {
    // Close all subscription clients
    for (const [topic, client] of this.clients) {
      client.close();
      this.clients.delete(topic);
      this.subscriptions.delete(topic);
    }

    // Close the publish client
    this.publishClient?.close();
  }
}
export default ValkeyPubSub;
