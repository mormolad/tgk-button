require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

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

logger.log('Запуск бота...');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Проверяем наличие переменных окружения
if (!process.env.TELEGRAM_BOT_TOKEN) {
  logger.error('Токен бота не указан в .env');
  process.exit(1);
}
if (!process.env.TELEGRAM_CHANNEL_ID) {
  logger.error('ID канала не указан в .env');
  process.exit(1);
}

// Создаем клавиатуру с кнопкой (постоянно висит внизу)
const channelButton = Markup.keyboard([
  ['Отправить кнопку в канал'], // Текст кнопки
]).resize();

// Обработчик команды /start
bot.start((ctx) => {
  logger.log(`Пользователь ${ctx.from.id} запустил бота`, 'USER');
  ctx.reply(
    'Нажмите кнопку ниже, чтобы отправить сообщение в канал',
    channelButton
  );
});

// Обработчик нажатия на кнопку
bot.hears('Отправить кнопку в канал', (ctx) => {
  try {
    const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    const USERNAME = 'mormolad'; // Ваш username

    logger.log(`Отправка сообщения в канал ${CHANNEL_ID}...`, 'BOT');

    // Формируем кнопку для канала
    const channelKeyboard = Markup.inlineKeyboard([
      Markup.button.url('Подобрать тур!', `https://t.me/${USERNAME}`),
    ]);

    // Отправляем сообщение в канал
    bot.telegram.sendMessage(
      CHANNEL_ID,
      '✨ Нажмите на кнопку ниже, чтобы подобрать тур!',
      channelKeyboard
    );

    ctx.reply('✅ Сообщение с кнопкой отправлено в канал!');
  } catch (error) {
    logger.error('Ошибка отправки в канал', 'BOT', error);
    ctx.reply('❌ Произошла ошибка при отправке сообщения в канал');
  }
});

// Обработчик текстовых сообщений (показывает кнопку снова)
bot.on('text', (ctx) => {
  ctx.reply('Используйте кнопку для отправки сообщения в канал', channelButton);
});

// Запуск бота
bot.launch().then(() => {
  logger.log('Бот успешно запущен');
});

// Обработка завершения работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
