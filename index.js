require('dotenv').config();
const { Telegraf, Scenes } = require('telegraf');
const sessionMiddleware = require('./middlewares/session');
const logger = require('./utils/logger');
const scenes = require('./scenes');

const { TELEGRAM_BOT_TOKEN } = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  logger.error('TELEGRAM_BOT_TOKEN не указан в .env');
  process.exit(1);
}

logger.log('[SYSTEM] Запуск бота...');

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// Middleware для сессий
bot.use(sessionMiddleware);

// Stage со всеми сценами
const stage = new Scenes.Stage(scenes);
bot.use(stage.middleware());

// Стартовая команда
bot.command('start', (ctx) => ctx.scene.enter('TOUR_QUESTIONNAIRE'));

// Глобальная обработка ошибок
bot.catch((err, ctx) => {
  logger.error(`[ERROR] Ошибка в апдейте: ${err.message}`, err);
});

// Запуск
bot
  .launch()
  .then(() => {
    logger.log('[SYSTEM] Бот запущен ✅');
  })
  .catch((err) => {
    logger.error('[SYSTEM] Ошибка запуска бота:', err);
  });

// Корректное завершение
process.once('SIGINT', () => {
  logger.log('[SYSTEM] Остановка бота (SIGINT) ❌');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  logger.log('[SYSTEM] Остановка бота (SIGTERM) ❌');
  bot.stop('SIGTERM');
});
