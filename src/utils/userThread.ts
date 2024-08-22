import { parentPort, workerData } from 'node:worker_threads';
import { 
    EthAddress, 
    isRegistered, 
    MessageData, 
    registerUser, 
    sendMessage, 
    startUserFetchProcess, 
    stopUserFetchProcess, 
    setBeeUrl
} from 'swarm-decentralized-chat';
import { generateID, sleep 
    
} from './misc.js';
import { UserThreadMessages } from '../types/types.js';

if (!parentPort) throw "Parent Port is null";

const { topic, params, address, privateKey, node, stamp, username } = workerData;

setBeeUrl(node);

startUserFetchProcess(topic);

// Register user
console.info(`Registering ${username} ...`);    // most likely we won't see this message...
await registerUser(topic, { 
    participant: address as EthAddress,
    key: privateKey,
    stamp: stamp,
    nickName: username
});
parentPort.postMessage(`User ${username} registered.`);


// Send messages
for (let i = 0; i < params.totalMessageCount; i++) {
    if (!isRegistered(address)) {                                                       // Re-register, if not on users list
        await registerUser(topic, { 
            participant: address as EthAddress,
            key: privateKey,
            stamp: stamp,
            nickName: username
        });
    }

    const timestamp = Date.now();
    const messageText = `Message from ${address} at ${new Date().toISOString()}`;
    const messageObj: MessageData = {
        message: messageText,
        username,
        address,
        timestamp
    };
    await sendMessage(
        address,
        topic,
        messageObj,
        stamp,
        privateKey
    );
    parentPort.postMessage({
        type: UserThreadMessages.INCREMENT_TOTAL_MESSAGE_COUNT,
        id: generateID(messageObj),
        timestamp
    });
    await sleep(params.messageFrequency);
}

stopUserFetchProcess();