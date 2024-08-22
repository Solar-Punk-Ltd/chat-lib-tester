import { parentPort, workerData } from 'node:worker_threads';

import { 
    EthAddress, 
    isRegistered, 
    MessageData, 
    registerUser, 
    sendMessage, 
    startUserFetchProcess, 
    stopUserFetchProcess, 
    setBeeUrl,
    getChatActions,
    EVENTS,
    startMessageFetchProcess
} from 'swarm-decentralized-chat';

import { generateID, sleep } from './misc.js';
import { UserThreadMessages } from '../types/types.js';


if (!parentPort) throw "Parent Port is null";

const { topic, params, address, privateKey, node, stamp, username } = workerData;

const { on } = getChatActions();

on(EVENTS.FEED_COMMIT_HASH, (hash) => {
    parentPort?.postMessage({
        type: UserThreadMessages.HASH_RECEIVED,
        hash: hash
    });
});

setBeeUrl(node);

startUserFetchProcess(topic);
startMessageFetchProcess(topic);

// Register user
console.info(`Registering ${username} ...`);    // most likely we won't see this message...
await registerUser(topic, { 
    participant: address as EthAddress,
    key: privateKey,
    stamp: stamp,
    nickName: username
});
parentPort.postMessage({                                                                // Signal to main thread that registration started
    type: UserThreadMessages.USER_REGISTERED,
    username,
    timestamp: Date.now()
});


// Send messages
for (let i = 0; i < params.totalMessageCount; i++) {
    if (!isRegistered(address)) {                                                       // Re-register, if not on users list
        await sleep(params.registrationInterval);                                       // Protect agains overload
        if (!isRegistered(address)) {
            console.info(`${username} is reconnecting...`);
            await registerUser(topic, { 
                participant: address as EthAddress,
                key: privateKey,
                stamp: stamp,
                nickName: username
            });
            parentPort.postMessage({                                                    // Signal to main thread that reconnect is happening
                type: UserThreadMessages.USER_RECONNECTED,
                username,
                timestamp: Date.now()
            });
        }
    }

    const timestamp = Date.now();
    const messageText = `Message from ${address} at ${new Date().toISOString()}`;       // Prepare message object
    const messageObj: MessageData = {
        message: messageText,
        username,
        address,
        timestamp
    };
    await sendMessage(                                                                  // Upload message to our own feed
        address,
        topic,
        messageObj,
        stamp,
        privateKey
    );
    parentPort.postMessage({                                                            // Signal to main thread that a message was sent
        type: UserThreadMessages.INCREMENT_TOTAL_MESSAGE_COUNT,
        id: generateID(messageObj),
        timestamp
    });
    await sleep(params.messageFrequency);
}

stopUserFetchProcess();