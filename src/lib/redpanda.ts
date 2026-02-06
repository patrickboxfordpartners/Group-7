// Redpanda (Kafka-compatible) event streaming

import { Kafka, type Producer } from 'kafkajs';

let producer: Producer | null = null;

async function getProducer(): Promise<Producer | null> {
  if (!process.env.REDPANDA_BROKERS) return null;

  if (!producer) {
    const kafka = new Kafka({
      clientId: 'credibility-agent',
      brokers: process.env.REDPANDA_BROKERS.split(','),
      ssl: process.env.REDPANDA_SSL === 'true' ? {} : undefined,
      sasl: process.env.REDPANDA_USERNAME
        ? {
            mechanism: 'scram-sha-256' as const,
            username: process.env.REDPANDA_USERNAME,
            password: process.env.REDPANDA_PASSWORD || '',
          }
        : undefined,
    });

    producer = kafka.producer();
    await producer.connect();
  }

  return producer;
}

export async function publishEvent(
  topic: string,
  event: Record<string, unknown>
): Promise<{ skipped?: boolean; published?: boolean }> {
  const p = await getProducer();
  if (!p) {
    console.log('[Redpanda] Not configured, skipping publish');
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
