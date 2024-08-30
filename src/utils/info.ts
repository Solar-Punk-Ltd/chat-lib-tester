import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { calcTimeDiff, formatWithSpaces, RunningAverage } from "./misc.js";
import { NodeListElement, UserInfo } from '../types/types.js';
import { Comment } from '../libs/comment-system/model/comment.model.js';


export function summary(
    filename: string,
    transmitAvg: RunningAverage,
    messages: Comment[],
    totalSentCount: number,
) {
    let summaryContent = "\n\n";
    summaryContent += "--- Test Summary ---\n\n";
    console.log(chalk.bold("\n--- Test Summary ---\n"));

    summaryContent += `  -- Message Stats --\n`
    summaryContent += `    Average transmission time: ${Math.ceil(transmitAvg.getAverage()/1000)} s\n`;
    summaryContent += `    TOTAL RECEIVED / TOTAL SENT: ${messages.length} / ${totalSentCount}\n\n`;
    
    console.log(chalk.yellow("  -- Message Stats --"));
    console.log(chalk.cyan(`    Average transmission time: ${chalk.magenta(Math.ceil(transmitAvg.getAverage()/1000))}`));
    console.log(chalk.cyan(`    TOTAL RECEIVED / TOTAL SENT: ${chalk.magenta(messages.length)} / ${chalk.magenta(totalSentCount)}\n`));

    
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