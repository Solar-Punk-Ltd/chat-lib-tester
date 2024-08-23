import { MessageData } from 'swarm-decentralized-chat';
import path from 'path';
import fs from 'fs';
import { calcTimeDiff, RunningAverage } from "./misc.js";
import { NodeListElement, UserInfo } from '../types/types.js';


export function summary(
    filename: string,
    transmitAvg: RunningAverage,
    messages: MessageData[],
    totalSentCount: number,
    userAnalytics: UserInfo,
    messageIdAnomaly: number,
    timestampAnomaly: number
) {
    const regTimeAvg = new RunningAverage(1000);
    const reconnectCountAvg = new RunningAverage(1000);
    let registrationFailedCount = 0;

    let summaryContent = "\n\n";
    summaryContent += "--- Test Summary ---\n\n";

    summaryContent += `  -- Message Stats --\n`
    summaryContent += `    Average transmission time: ${Math.ceil(transmitAvg.getAverage()/1000)} s\n`;
    summaryContent += `    TOTAL RECEIVED / TOTAL SENT: ${messages.length} / ${totalSentCount}\n\n`;

    summaryContent += "  -- User Stats --\n";    
    for (const [username, stats] of Object.entries(userAnalytics)) {
        const diff = calcTimeDiff(stats.registrationStarted, stats.registrationSuccess);
        if (diff < 0) {
            registrationFailedCount++;
            summaryContent += `      ${username} failed to register. Reconnect count: ${stats.reconnectCount}\n`;
        }
        else {
            regTimeAvg.addValue(diff);
            summaryContent += `      ${username} registered in ${diff} ms. Reconnect count: ${stats.reconnectCount}\n`;
        }
        reconnectCountAvg.addValue(stats.reconnectCount);
    }
    summaryContent += `\n      Registration time on average: ${Math.floor(regTimeAvg.getAverage()/1000)} s\n`;
    summaryContent += `      Reconnect count on average: ${reconnectCountAvg.getAverage()}\n`;
    summaryContent += `      Registration failed for ${registrationFailedCount} users\n`;

    if (messageIdAnomaly) summaryContent += `  There were ${messageIdAnomaly} message ID anomalies!`;
    if (timestampAnomaly) summaryContent += `  There were ${timestampAnomaly} timestamp anomalies!`;

    summaryContent += "\n";

    const reportsDir = './reports';
    const filePath = path.join(reportsDir, filename);
    fs.appendFileSync(filePath, summaryContent);

    console.info(summaryContent);
}

export function writeNodeInfoToFile(filename: string, nodeList: NodeListElement[]) {
    const reportsDir = './reports';
    const filePath = path.join(reportsDir, filename);

    let nodeSummary = "\n\n--- Node List ---\n";

    nodeList.forEach((node) => {
        nodeSummary += `    URL: ${node.url}, Stamp: ${node.stamp}\n`;
    });

    nodeSummary += `\n    Total node count: ${nodeList.length}\n`;

    fs.appendFileSync(filePath, nodeSummary);

    console.info(nodeSummary);
}