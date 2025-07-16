require('dotenv').config();
const { Telegraf, Scenes, Markup, session } = require('telegraf');
const { Stage } = Scenes;
const LocalSession = require('telegraf-session-local');
const { tourQuestionnaire } = require('./scenes/tourWizard');
const { logger } = require('./utils/logger');

// Инициализация бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

logger.log('Запуск бота...');

// Проверка критических переменных окружения
if (!process.env.TELEGRAM_BOT_TOKEN) {
  logger.error('Токен бота не указан в .env');
  process.exit(1);
}
if (!process.env.ADMIN_CHAT_ID) {
  logger.error('ADMIN_CHAT_ID не указан в .env');
  process.exit(1);
}

// Настройка локального хранилища сессий
const localSession = new LocalSession({ database: 'session_db.json' });
bot.use(localSession.middleware());

// Настройка сцен
const stage = new Stage([tourQuestionnaire]);
bot.use(stage.middleware());

// Команда старта
bot.start((ctx) => {
  logger.log(`Пользователь ${ctx.from.id} запустил бота`, 'USER');
  return ctx.scene.enter('TOUR_QUESTIONNAIRE');
});
// Команда сброса опроса
bot.command('reset', async (ctx) => {
  try {
    if (ctx.scene.current) {
      await ctx.scene.leave();
    }

    ctx.session = {};
    await ctx.reply('Опрос сброшен. Начинаем заново!', Markup.removeKeyboard());
    return ctx.scene.enter('TOUR_QUESTIONNAIRE');
  } catch (error) {
    console.error('Reset error:', error);
    await ctx.reply('Произошла ошибка при сбросе. Попробуйте ещё раз.');
  }
});

// Обработчик текстовых сообщений (на случай, если пользователь заблудился)
bot.on('text', (ctx) => {
  if (!ctx.scene.current) {
    ctx.reply(
      'Для подбора тура отправте боту /start',
      Markup.keyboard([['/start']]).resize()
    );
  }
});

// Запуск бота
bot.launch().then(() => {
  logger.log('Бот успешно запущен');
});

// Обработка завершения работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
