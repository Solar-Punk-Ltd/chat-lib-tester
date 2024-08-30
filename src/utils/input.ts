import readlineSync from 'readline-sync';
import fs from 'fs';
import path from 'path';


// Generic function for reading numbers from the console
function getNumberInput(prompt: string, defaultInput: string): number {
    const value = readlineSync.questionInt(`${prompt} (default: ${defaultInput}): `, { defaultInput });
    return value;
}

export function getUserInputs(usersFeedTimeout: number) {
    const userCount = getNumberInput("Enter the number of users", "50");
    const messageFrequency = getNumberInput("Enter the message frequency (seconds)", "2") * 1000;
    //const registrationInterval = getNumberInput("Enter the registration interval (seconds)", "5") * 1000;
    const readInterval = getNumberInput("Enter the feed read interval (seconds)", "2") * 1000;
    const registrationInterval = 0;
    const totalMessageCount = getNumberInput("Enter total message count", "20");
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const filename = `summary_${timestamp}.txt`;

    inputSummary(userCount, messageFrequency, readInterval, registrationInterval, totalMessageCount, usersFeedTimeout, filename)
  
    return {
        userCount,
        messageFrequency,
        readInterval,
        registrationInterval,
        totalMessageCount,
        filename
    };
};

function inputSummary(
    userCount: number, 
    messageFrequency: number,
    readInterval: number,
    registrationInterval: number,
    totalMessageCount: number,
    usersFeedTimeout: number,
    filename: string
) {
    const summary = `
--- Input Summary ---
    User Count: ${userCount}
    Message Frequency: ${messageFrequency} milliseconds
    Read Interval: ${readInterval} milliseconds
    Registration Interval: ${registrationInterval} milliseconds
    Total message count (per user): ${totalMessageCount}
    UsersFeed write timeout: ${usersFeedTimeout} milliseconds
    `;

    console.log(summary);

    const reportsDir = './reports';
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filePath = path.join(reportsDir, filename);
    fs.writeFileSync(filePath, summary.trim());
}