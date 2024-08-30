import { parentPort, workerData } from 'node:worker_threads';
import { generateID, sleep } from './misc.js';
import { UserThreadMessages } from '../types/types.js';
import logger from '../utils/logger.js';
import { writeComment } from '../libs/comment-system/comments.js';
import { CommentRequest } from '../libs/comment-system/model/comment.model.js';
import { Options } from '../libs/comment-system/model/options.model.js';

if (!parentPort) throw "Parent Port is null";

// Parameters from the main thread
const { 
    identifier, 
    params, 
    username,
    signer,
    node,
    stamp, 
} = workerData;

// Send messages
for (let i = 0; i < params.totalMessageCount; i++) {
    const timestamp = Date.now();
    const messageText = `Message from ${username} at ${new Date().toISOString()}`;       // Prepare message object
    const comment: CommentRequest = {
        user: username,
        data: messageText,
        timestamp
    };
    const options: Options = {
        stamp,
        identifier,
        signer,
        beeApiUrl: node.url
    }
    const newComment = await writeComment(comment, options);                            // Send message
    if (!newComment) throw "Comment write failed."


    parentPort.postMessage({                                                            // Signal to main thread that a message was sent
        type: UserThreadMessages.INCREMENT_TOTAL_MESSAGE_COUNT,
        id: generateID(comment),
        timestamp
    });
    await sleep(params.messageFrequency);
}