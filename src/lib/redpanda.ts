// Redpanda (Kafka-compatible) event streaming

import { Kafka, type Producer } from 'kafkajs';

let producer: Producer | null = null;
let connectionFailed = false;

async function getProducer(): Promise<Producer | null> {
  if (!process.env.REDPANDA_BROKERS) return null;
  if (connectionFailed) return null; // Don't retry after failure during demo

  if (!producer) {
    try {
      const kafka = new Kafka({
        clientId: 'credibility-agent',
        brokers: process.env.REDPANDA_BROKERS.split(','),
        ssl: true,
        sasl: process.env.REDPANDA_USERNAME
          ? {
              mechanism: 'scram-sha-256' as const,
              username: process.env.REDPANDA_USERNAME,
              password: process.env.REDPANDA_PASSWORD || '',
            }
          : undefined,
        connectionTimeout: 5000,
        requestTimeout: 5000,
      });

      producer = kafka.producer();
      await producer.connect();
      console.log('[Redpanda] Connected successfully');
    } catch (err) {
      console.error('[Redpanda] Connection failed:', err);
      connectionFailed = true;
      producer = null;
      return null;
    }
  }

  return producer;
}

export async function publishEvent(
  topic: string,
  event: Record<string, unknown>
): Promise<{ skipped?: boolean; published?: boolean; error?: string }> {
  const p = await getProducer();
  if (!p) {
    const reason = connectionFailed ? 'connection failed' : 'not configured';
    console.log(`[Redpanda] ${reason}, skipping publish`);
    return { skipped: true };
  }

  await p.send({
    topic,
    messages: [
      {
        key: (event.id as string) || undefined,
        value: JSON.stringify(event),
      },
    ],
  });

  return { published: true };
}
