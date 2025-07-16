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

const logStep = (ctx, stepName) => {
  const userId = ctx.from.id;
  const username = ctx.from.username
    ? `@${ctx.from.username}`
    : ctx.from.first_name;
  const state = JSON.stringify(ctx.wizard.state, null, 2);

  console.log(`\n--- Шаг ${stepName} ---`);
  console.log(`Пользователь: ${username} (ID: ${userId})`);
  console.log(
    `Сообщение: ${ctx.message.text ? ctx.message.text : 'Нет текста'}`
  );
  console.log(`Состояние:`, state);
  console.log('----------------------');
};

module.exports = { logger, logStep };
