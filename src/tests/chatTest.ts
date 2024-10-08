import { Worker } from 'node:worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { BatchId } from '@ethersphere/bee-js';
import { ethers } from 'ethers';

import { 
    MessageData,
    EVENTS,
    SwarmChat,
} from 'swarm-decentralized-chat';

import logger from '../utils/logger.js';
import { FeedCommitHashList, MessageInfo, NodeListElement, TestParams, UserInfo, UserThreadMessages } from '../types/types.js';
import { generateID, sleep, RunningAverage, determineDone } from '../utils/misc.js';
import { summary, writeNodeInfoToFile } from '../utils/info.js';
import { getUserInputs } from '../utils/input.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const nodeList: NodeListElement[] = [
    { url: "http://161.97.125.121:1733" , stamp: "22f189ea0fd9ee878275effa117f24e8d127162d58bf7a32da790eb6e454880d" as BatchId },
    { url: "http://161.97.125.121:1833" , stamp: "29644f86cf8624bbc8c60fc27415531053b248cc5b85137775c4c0c61c6cec55" as BatchId },
    //{ url: "http://161.97.125.121:2033" , stamp: "853b2ba750104ad22bd243779750d31492023a6217c69fa2408d034d8b4b2c56" as BatchId },
    //{ url: "http://161.97.125.121:2133" , stamp: "6ca7647e9887386f89e93217d68abd3c6c172ed232bb4fbe39527a1090ed6779" as BatchId },
    //{ url: "http://161.97.125.121:2233" , stamp: "4dec689f3ff1d3af52d9fadd33c44f2eb06f755468e546505a04d9f67317390c" as BatchId },
    //{ url: "http://161.97.125.121:2333" , stamp: "7e135a60a2ce6984724ce23a4e64c491acb8bf9d55cd5bb0dd3a2e4d19c05a02" as BatchId },
    //{ url: "http://161.97.125.121:2433" , stamp: "feef29cbc85dc218a38716f753f0a0d381411a2b4c2b00d4f1be275479c4743d" as BatchId },
    //{ url: "http://195.88.57.155:1633" ,  stamp: "6e26e6c31623bfcfa1df4140a98286cd27bcd84c628d6fafd63757ba8d706a6c" as BatchId },
];

let messages: MessageData[] = [];
let messageAnalyitics: MessageInfo = {};
let userAnalytics: UserInfo = {};
let startTime = 0;
let intervalId: NodeJS.Timeout | null = null;                          // Interval to check whether the process is finished or not (if not all messages can be sent)
let totalSentCount = 0;
let feedCommitHashList: FeedCommitHashList = {};
const transmitAvg: RunningAverage = new RunningAverage(1000);
let messageIdAnomaly = 0;
let timestampAnomaly = 0;
let isDone = false;
const usersFeedTimeout = 20000;                                        // 20 seconds. This is not prompted from the user, but it could be. Will be visible in stats.


// The main chat test, currently this is the only one, but probably there will be more
export async function startChatTest() {
    const topic = `Chat-Library-Test-${Math.floor(Math.random() * 10000)}`;
    const userThreadList: Worker[] = [];

    const params = getUserInputs(usersFeedTimeout);
    writeNodeInfoToFile(params.filename, nodeList);

    // Generate a list of private keys, each associated to a user
    const walletList = [];
    for (let i = 0; i < params.userCount; i++) {
        const wallet = ethers.Wallet.createRandom();
        walletList.push(wallet);
    }

    // Create the chat room
    logger.info("Creating chat room...");
    const chat = new SwarmChat({ url: nodeList[0].url, logLevel: "warn", idleTime: 10 * 60 * 1000 });
    chat.initChatRoom(topic, nodeList[0].stamp);
    startTime = Date.now();
    logger.info(`Done! Now we will wait ${params.registrationInterval} ms before starting registration. \n`);
    await sleep(params.registrationInterval);

    // This user (on the main thread), will only read messages, and create stats based on that
    chat.startUserFetchProcess(topic);
    chat.startMessageFetchProcess(topic);
    const { on } = chat.getChatActions();

    // Some analytics is happening in handle-functions
    on(EVENTS.RECEIVE_MESSAGE, async (newMessages: MessageData[]) => {
        handleMessageReceive(chat, newMessages, params, userThreadList);
    });
    on(EVENTS.USER_REGISTERED, handleUserRegistered);

    // Stop the test process on timeout as well, not just if all messages were sent
    intervalId = setInterval(() => {
        if (determineDone(params, startTime, messageAnalyitics))
            done(chat, userThreadList, params.filename);
    }, 15 * 1000);
    
    // This are the users, who are registering, and writing messages, each has a separate Worker thread
    logger.info("Registering users...");
    for (let i = 0; i < walletList.length; i++) {
        const nodeIndex = i % nodeList.length;      // This will cycle through nodeList indices
        const userThread = new Worker(path.resolve(__dirname, '../utils/userThread.js'), {
            workerData: {
                topic,
                params,
                address: walletList[i].address,
                privateKey: walletList[i].privateKey,
                node: nodeList[nodeIndex].url,
                nodeList: nodeList,
                usersFeedTimeout,
                stamp: nodeList[nodeIndex].stamp,
                username: `user-${i}`
            },
            stdout: false,
            stderr: false
        });

        // Handle the messages (notifications) that are coming from Worker threads
        handleUserThreadEvent(userThread);
        
        if (i < walletList.length-1) logger.info(`Waiting ${params.registrationInterval} ms until next user registration...`); 
        await sleep(params.registrationInterval);
        userThreadList.push(userThread);
    };
}   

async function handleMessageReceive(chat: SwarmChat, newMessages: MessageData[], params: TestParams, userThreadList: Worker[]) {
    const i = newMessages.length-1;
    const id = generateID(newMessages[i]);

    // Take note when the message was received. If message ID can't be found, that's an error.
    if (!messageAnalyitics[id]) {
        logger.warn("WARNING! MESSAGE COULD NOT BE FOUND, THIS IS AN ANOMALY!");
        logger.trace("It seems like message was received before it was sent, or the ID is wrong.");
        logger.trace(`ID of the message:  ${id}`);
        messageAnalyitics[id] = {
            sent: 0,
            received: Date.now()
        }
        messageAnalyitics[id].received = Date.now();
        messageIdAnomaly++;
    } else {
        messageAnalyitics[id].received = Date.now();
    }

    logger.info(`${newMessages[i].message}`);                   // New message
    logger.debug(`User count:  ${chat.getUserCount()}`);

    // Calculate transmission time. If some of the values does not look like a timestamp, that's an error.
    if (messageAnalyitics[id].received < 1600000000000 || messageAnalyitics[id].sent < 1600000000000) {
        logger.warn("WARNING! ANOMALY, received or sent is not correct timestamp");
        logger.trace(`Received:  ${messageAnalyitics[id].received}`);
        logger.trace(`Sent:  ${messageAnalyitics[id].sent}`);
        timestampAnomaly++;
    } else {
        const time = messageAnalyitics[id].received - messageAnalyitics[id].sent;
        transmitAvg.addValue(time);
        logger.info(`Transmission time: ${time} ms. Average: ${Math.ceil(transmitAvg.getAverage()/1000)} s`);
    }


    const uniqueNewMessages = newMessages.filter(
        (newMsg) => !messages.some((prevMsg) => prevMsg.timestamp === newMsg.timestamp),
    );
    messages = chat.orderMessages([...messages, ...uniqueNewMessages]);

    logger.info(`TOTAL RECEIVED / TOTAL SENT: ${messages.length} / ${totalSentCount} \n`);

    if (determineDone(params, startTime, messageAnalyitics)) 
        done(chat, userThreadList, params.filename);
};

function handleUserRegistered(username: string) {
    if (userAnalytics[username].registrationSuccess) {
        // This is a reconnect
        return;
    } else {
        // This is a register event
        userAnalytics[username].registrationSuccess = Date.now();
    }
}

function handleUserThreadEvent(userThread: Worker) {
    userThread.on("message", (messageFromThread) => {
        switch (messageFromThread.type) {
            case UserThreadMessages.INCREMENT_TOTAL_MESSAGE_COUNT:
                messageAnalyitics[messageFromThread.id] = {
                    sent: messageFromThread.timestamp,
                    received: 0
                }
                totalSentCount++;

                break;

            case UserThreadMessages.USER_REGISTERED:
                userAnalytics[messageFromThread.username] = {
                    registrationStarted: messageFromThread.timestamp,
                    registrationSuccess: 0,
                    reconnectTimes: [],
                    reconnectCount: 0
                }

                break;

            case UserThreadMessages.USER_RECONNECTED:
                userAnalytics[messageFromThread.username].reconnectTimes.push(messageFromThread.timestamp);
                userAnalytics[messageFromThread.username].reconnectCount++;

                break;

            case UserThreadMessages.HASH_RECEIVED:
                if (feedCommitHashList[messageFromThread.hash]) {
                    feedCommitHashList[messageFromThread.hash].count++;
                } else {
                    feedCommitHashList[messageFromThread.hash] = {
                        count: 1
                    }
                }
                logger.trace("Hash list with counts: ");
                Object.keys(feedCommitHashList).forEach((key) => logger.trace(`${key}: ${feedCommitHashList[key].count}`));

                break;

            case UserThreadMessages.ERROR:
                logger.error(`Error on the instance of ${messageFromThread.username}: ${messageFromThread.error.error}`);
                // We could count number of errors, and things like that.

                break;

            default:
                logger.warn("Received message from user threa, that does not have a known label.");
        }
    });
}

async function done(chat: SwarmChat, userThreadList: Worker[], filename: string) {
    if (intervalId) clearInterval(intervalId);                      // Stop the timeout interval
    else return;
    
    if (isDone) return;                                             // A handleMessage function might be still running
    isDone = true;

    await sleep(Math.floor(transmitAvg.getAverage()*1.2));          // Wait for last messages
        
    for (let k = 0; k < userThreadList.length; k++) {               // Terminate all threads
        (await userThreadList[k]).terminate();
    }

    chat.stopMessageFetchProcess();                                 // Stop periodically fetching messages
    chat.stopUserFetchProcess();                                    // and Users feed updates
    await sleep(1000);

    summary(
        filename, 
        transmitAvg, 
        messages, 
        totalSentCount, 
        userAnalytics,
        messageIdAnomaly,
        timestampAnomaly
    );
}