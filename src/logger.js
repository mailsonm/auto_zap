import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logsDir = join(__dirname, '..', 'logs');

// Garantir que a pasta de logs existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Formato legível no console
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? '\n  ' + JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')
      : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// Formato JSON para arquivo (produção/análise)
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: consoleFormat,
    silent: process.env.NODE_ENV === 'test'
  })
];

// Em produção, também salvar em arquivo
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat
    }),
    new winston.transports.File({
      filename: join(logsDir, 'app.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports
});

export default logger;
