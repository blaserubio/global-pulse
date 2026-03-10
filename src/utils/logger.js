import winston from 'winston';
import config from '../config/index.js';

const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'global-pulse' },
  transports: [
    new winston.transports.Console({
      format:
        config.nodeEnv === 'production'
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length > 1
                  ? ` ${JSON.stringify(meta, null, 0)}`
                  : '';
                return `${timestamp} [${level}]: ${message}${metaStr}`;
              })
            ),
    }),
  ],
});

export default logger;
