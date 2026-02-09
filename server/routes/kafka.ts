import { Kafka, KafkaConfig, Consumer } from 'kafkajs';

const config = useRuntimeConfig();

const kafkaConfig: KafkaConfig = {
    brokers: [`${config.kafkaAddress}:${config.kafkaPort}`],
};
const kafka = new Kafka(kafkaConfig);

const activeConsumers = new Map<any, Consumer>();
async function switchTopic(peer: any, newTopic: string) {
    const existingConsumer = activeConsumers.get(peer);
    if (existingConsumer) {
        console.log(`[ws] Switching topics. Disconnecting old consumer for peer.`);
        await existingConsumer.disconnect();
    }

    const consumer = kafka.consumer({
        groupId: `ws-user-${Date.now()}-${Math.random()}`
    });

    activeConsumers.set(peer, consumer);

    try {
        await consumer.connect();

        await consumer.subscribe({ topic: newTopic, fromBeginning: false });
        console.log(`[ws] Subscribed peer to: ${newTopic}`);

        await consumer.run({
            eachMessage: async ({ message }) => {
                if (message.value) {
                    peer.send(message.value.toString());
                }
            },
        });
    } catch (err) {
        console.error(`[ws] Failed to switch to topic ${newTopic}`, err);
        peer.send(`Error: Could not subscribe to ${newTopic}`);
    }
}

export default defineWebSocketHandler({
    async open(peer) {
        console.log("[ws] connected", peer);
        peer.send("Connected. Send a topic name to subscribe.");
    },

    async message(peer, message) {
        const topic = message.text();
        console.log("[ws] User requested topic:", topic);

        await switchTopic(peer, topic);
    },

    async close(peer, event) {
        console.log("[ws] closed", peer, event);
        const consumer = activeConsumers.get(peer);
        if (consumer) {
            await consumer.disconnect();
            activeConsumers.delete(peer);
        }
    },

    error(peer, error) {
        console.log("[ws] error", peer, error);
    },
});