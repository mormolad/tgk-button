require('dotenv').config();
const { Telegraf, Scenes } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const tourWizard = require('./scenes/tourWizard');
const logger = require('./utils/logger');

const { TELEGRAM_BOT_TOKEN } = process.env;

if (!TELEGRAM_BOT_TOKEN) {
    logger.error('TELEGRAM_BOT_TOKEN не указан в .env');
    process.exit(1);
}

logger.log('[SYSTEM] Запуск бота...');

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// ✅ Используем только LocalSession (без telegraf.session())
const localSession = new LocalSession({
    database: 'session/session_db.json',
});
bot.use(localSession.middleware());

const stage = new Scenes.Stage([tourWizard]);
bot.use(stage.middleware());

// Запуск сцены
bot.command('start', (ctx) => ctx.scene.enter('TOUR_QUESTIONNAIRE'));

bot
    .launch()
    .then(() => {
        logger.log('[SYSTEM] Бот запущен ✅');
    })
    .catch((err) => {
        logger.error('[SYSTEM] Ошибка запуска бота:', err);
    });