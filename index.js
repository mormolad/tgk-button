require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Проверяем наличие переменных окружения
if (!process.env.TELEGRAM_BOT_TOKEN) {
  process.exit(1);
}
if (!process.env.TELEGRAM_CHANNEL_ID) {
  process.exit(1);
}
if (!process.env.POLL_BOT_ID) {
  process.exit(1);
}

// Создаем клавиатуру с кнопкой (постоянно висит внизу)
const channelButton = Markup.keyboard([
  ['Отправить кнопку в канал'], // Текст кнопки
]).resize();

// Обработчик команды /start
bot.start((ctx) => {
  ctx.reply(
    'Нажмите кнопку ниже, чтобы отправить сообщение в канал',
    channelButton
  );
});

// Обработчик нажатия на кнопку
bot.hears('Отправить кнопку в канал', (ctx) => {
  try {
    const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    const POLL_BOT_ID = process.env.POLL_BOT_ID;

    // Формируем ссылку на бота с опросом
    // Если это username (начинается с @), убираем @, иначе используем как есть
    const botLink = POLL_BOT_ID.startsWith('@')
      ? `https://t.me/${POLL_BOT_ID.slice(1)}`
      : `https://t.me/${POLL_BOT_ID}`;

    // Формируем кнопку для канала
    const channelKeyboard = Markup.inlineKeyboard([
      Markup.button.url('Подобрать тур!', botLink),
    ]);

    // Отправляем сообщение в канал
    bot.telegram.sendMessage(
      CHANNEL_ID,
      '✨ Нажмите на кнопку ниже, чтобы подобрать тур!',
      channelKeyboard
    );

    ctx.reply('✅ Сообщение с кнопкой отправлено в канал!');
  } catch (error) {
    ctx.reply('❌ Произошла ошибка при отправке сообщения в канал');
  }
});

// Обработчик текстовых сообщений (показывает кнопку снова)
bot.on('text', (ctx) => {
  ctx.reply('Используйте кнопку для отправки сообщения в канал', channelButton);
});

// Запуск бота
bot.launch();

// Обработка завершения работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
