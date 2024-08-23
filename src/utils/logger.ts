import pino from 'pino';
import { PinoPretty } from 'pino-pretty';

const prettyStream = PinoPretty({
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname'
});

const logger = pino({ level: "debug" }, prettyStream);

export default logger;