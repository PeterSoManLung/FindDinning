export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export function createLogger(serviceName: string): Logger {
  const formatMessage = (level: string, message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    return `[${timestamp}] [${level}] [${serviceName}] ${message}${formattedArgs}`;
  };

  return {
    info: (message: string, ...args: any[]) => {
      console.log(formatMessage('INFO', message, ...args));
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(formatMessage('WARN', message, ...args));
    },
    error: (message: string, ...args: any[]) => {
      console.error(formatMessage('ERROR', message, ...args));
    },
    debug: (message: string, ...args: any[]) => {
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
        console.debug(formatMessage('DEBUG', message, ...args));
      }
    }
  };
}