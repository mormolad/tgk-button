const logger = {
    log: (msg, src = 'SYSTEM') => {
        const ts = new Date().toISOString();
        console.log(`[${ts}] [${src}] ${msg}`);
    },
    error: (msg, src = 'SYSTEM', err = null) => {
        const ts = new Date().toISOString();
        console.error(`[${ts}] [${src}] ❌ ${msg}`);
        if (err) console.error(err.stack || err);
    },
};

module.exports = logger;