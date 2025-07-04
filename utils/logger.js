// Настройка логгера
const logger = {
  log: (message, source = 'SYSTEM') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${source}] ${message}`);
  },
  error: (message, source = 'SYSTEM', error = null) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${source}] ❌ ${message}`);
    if (error) console.error(error.stack || error);
  },
};

module.exports = logger;
