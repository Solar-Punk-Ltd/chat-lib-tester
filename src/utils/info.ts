import { MessageData } from 'swarm-decentralized-chat';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { calcTimeDiff, formatWithSpaces, RunningAverage } from "./misc.js";
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
    console.log(chalk.bold("\n--- Test Summary ---\n"));

    summaryContent += `  -- Message Stats --\n`
    summaryContent += `    Average transmission time: ${Math.ceil(transmitAvg.getAverage()/1000)} s\n`;
    summaryContent += `    TOTAL RECEIVED / TOTAL SENT: ${messages.length} / ${totalSentCount}\n\n`;
    
    console.log(chalk.yellow("  -- Message Stats --"));
    console.log(chalk.cyan(`    Average transmission time: ${chalk.magenta(Math.ceil(transmitAvg.getAverage()/1000))}`));
    console.log(chalk.cyan(`    TOTAL RECEIVED / TOTAL SENT: ${chalk.magenta(messages.length)} / ${chalk.magenta(totalSentCount)}\n`));

    summaryContent += "  -- User Stats --\n";
    console.log(chalk.yellow("  -- User Stats --"));
    for (const [username, stats] of Object.entries(userAnalytics)) {
        const diff = calcTimeDiff(stats.registrationStarted, stats.registrationSuccess);
        if (diff < 0) {
            registrationFailedCount++;
            summaryContent += `      ${username} failed to register. Reconnect count: ${stats.reconnectCount}\n`;
            console.log(chalk.green(`      ${username} failed to register. Reconnect count: ${chalk.magenta(stats.reconnectCount)}`));
        }
        else {
            regTimeAvg.addValue(diff);
            summaryContent += `      ${username} registered in ${formatWithSpaces(diff)} ms. Reconnect count: ${stats.reconnectCount}\n`;
            console.log(chalk.green(`      ${username} registered in ${chalk.magenta(formatWithSpaces(diff))} ms. Reconnect count: ${chalk.magenta(stats.reconnectCount)}`));
        }
        reconnectCountAvg.addValue(stats.reconnectCount);
    }
    summaryContent += `\n      Registration time on average: ${Math.floor(regTimeAvg.getAverage()/1000)} s\n`;
    summaryContent += `      Reconnect count on average: ${reconnectCountAvg.getAverage()}\n`;
    summaryContent += `      Registration failed for ${registrationFailedCount} users\n`;

    console.log(chalk.green(`\n      Registration time on average:  ${chalk.magenta(Math.floor(regTimeAvg.getAverage()/1000))} s`));
    console.log(chalk.green(`      Reconnect count on average: ${chalk.magenta(reconnectCountAvg.getAverage())}`));
    console.log(chalk.green(`      Registration failed for ${chalk.magenta(registrationFailedCount)} users\n\n`));

    if (messageIdAnomaly) summaryContent += `\n      There were ${messageIdAnomaly} message ID anomalies!`;
    if (timestampAnomaly) summaryContent += `      There were ${timestampAnomaly} timestamp anomalies!`;

    if (messageIdAnomaly) console.log(chalk.gray(`      There were ${chalk.cyan(messageIdAnomaly)} message ID anomalies!`));
    if (timestampAnomaly) console.log(chalk.gray(`      There were ${chalk.cyan(timestampAnomaly)} timestamp anomalies!\n\n`));

    summaryContent += "\n";

    const reportsDir = './reports';
    const filePath = path.join(reportsDir, filename);
    fs.appendFileSync(filePath, summaryContent);

    //console.info(summaryContent);
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