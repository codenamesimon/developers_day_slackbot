// Shared logger instance using winston

import winston from 'winston';
import {LoggingWinston} from '@google-cloud/logging-winston';

const env = process.env.NODE_ENV || 'development';

const transports: winston.transport[] = env === 'development'
    ? [ new winston.transports.Console() ]
    : [ new LoggingWinston({}) ];

const logger: winston.Logger = winston.createLogger(
    {
        level: env === 'development' ? 'verbose' : 'info',
        format: winston.format.json(),
        transports
    }
);

export { logger };