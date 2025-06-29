require('dotenv').config();
const { Telegraf, Scenes, Markup, session } = require('telegraf');
const { Stage } = Scenes;
const LocalSession = require('telegraf-session-local');

// Инициализация бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

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

// Сцена опросника для подбора тура
const tourQuestionnaire = new Scenes.WizardScene(
  'TOUR_QUESTIONNAIRE',

  // Шаг 1: Приветствие и начало
  async (ctx) => {
    await ctx.reply(
      `Привет, ${
        ctx.from.first_name || 'путешественник'
      }! 👋\nЯ твой персональный помощник по подбору туров. Ответь на несколько вопросов, и я найду идеальный вариант для тебя!`,
      Markup.keyboard([['Начать опрос ▶️']]).resize()
    );
    return ctx.wizard.next();
  },

  // Шаг 2: Город вылета
  async (ctx) => {
    if (!ctx.message.text.includes('Начать')) {
      await ctx.reply('Нажми "Начать опрос ▶️", чтобы продолжить');
      return;
    }
    await ctx.reply('Из какого города планируете вылет? 🏙️');
    return ctx.wizard.next();
  },

  // Шаг 3: Направление
  async (ctx) => {
    ctx.wizard.state.city = ctx.message.text;
    await ctx.reply('Куда хотите поехать? 🌍 (Страна, курорт или "море/горы")');
    return ctx.wizard.next();
  },

  // Шаг 4: Даты
  async (ctx) => {
    ctx.wizard.state.destination = ctx.message.text;
    await ctx.reply(
      'Когда планируете путешествие? 📅',
      Markup.keyboard([
        ['Июль-Август ☀️', 'Сентябрь-Октябрь 🍂'],
        ['Ноябрь-Март ❄️', 'Апрель-Июнь 🌸'],
        ['Конкретные даты'],
      ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
  },

  // Шаг 5: Уточнение дат
  async (ctx) => {
    ctx.wizard.state.travelPeriod = ctx.message.text;

    if (ctx.message.text === 'Конкретные даты') {
      await ctx.reply('Введите дату вылета (ДД.ММ.ГГГГ):');
      return ctx.wizard.next();
    }

    await ctx.reply(
      'На сколько ночей планируете? 🌙',
      Markup.keyboard([
        ['7-10 ночей', '10-14 ночей'],
        ['2 недели+', 'Короткий тур (3-5 ночей)'],
      ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.selectStep(7); // Переход к шагу 7
  },

  // Шаг 6: Обработка конкретных дат
  async (ctx) => {
    // Простая валидация даты
    if (!/\d{2}\.\d{2}\.\d{4}/.test(ctx.message.text)) {
      await ctx.reply('Пожалуйста, введите дату в формате ДД.ММ.ГГГГ');
      return;
    }

    ctx.wizard.state.departureDate = ctx.message.text;
    await ctx.reply('Введите дату возвращения (ДД.ММ.ГГГГ):');
    return ctx.wizard.next();
  },

  // Шаг 7: Количество ночей
  async (ctx) => {
    if (ctx.wizard.state.departureDate) {
      // Валидация даты возвращения
      if (!/\d{2}\.\d{2}\.\d{4}/.test(ctx.message.text)) {
        await ctx.reply('Пожалуйста, введите дату в формате ДД.ММ.ГГГГ');
        return;
      }
      ctx.wizard.state.returnDate = ctx.message.text;
    }

    await ctx.reply(
      'На сколько ночей планируете? 🌙',
      Markup.keyboard([
        ['7-10 ночей', '10-14 ночей'],
        ['2 недели+', 'Короткий тур (3-5 ночей)'],
      ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
  },

  // Шаг 8: Состав группы
  async (ctx) => {
    ctx.wizard.state.nights = ctx.message.text;
    await ctx.reply(
      'С кем путешествуете? 👨‍👩‍👧‍👦',
      Markup.keyboard([
        ['Один/одна', 'Пара/Вдвоём'],
        ['С детьми 👶', 'С друзьями'],
        ['Семья (взрослые)', 'Группа (6+ человек)'],
      ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
  },

  // Шаг 9: Детали группы
  async (ctx) => {
    ctx.wizard.state.companions = ctx.message.text;

    if (
      ctx.message.text.includes('детьми') ||
      ctx.message.text.includes('Группа')
    ) {
      await ctx.reply(
        'Сколько будет детей и их возраст? (Например: 1 ребёнок 5 лет, 2 ребёнка 8 и 10 лет)'
      );
      return ctx.wizard.next();
    }

    await ctx.reply(
      'Какой тип отдыха предпочитаете?',
      Markup.keyboard([
        ['Пляжный 🏖️', 'Экскурсионный 🏛️'],
        ['Горнолыжный ⛷️', 'SPA/Оздоровление 💆‍♀️'],
        ['Активный 🚵‍♀️', 'Городской 🏙️'],
      ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.selectStep(11); // Пропуск шага про детей
  },

  // Шаг 10: Информация о детях
  async (ctx) => {
    ctx.wizard.state.childrenInfo = ctx.message.text;
    await ctx.reply(
      'Какой тип отдыха предпочитаете?',
      Markup.keyboard([
        ['Пляжный 🏖️', 'Экскурсионный 🏛️'],
        ['Горнолыжный ⛷️', 'SPA/Оздоровление 💆‍♀️'],
        ['Активный 🚵‍♀️', 'Городской 🏙️'],
      ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
  },

  // Шаг 11: Тип отдыха
  async (ctx) => {
    ctx.wizard.state.tourType = ctx.message.text;
    await ctx.reply(
      'Какое размещение предпочитаете? 🏨',
      Markup.keyboard([
        ['Всё включено 🍹', 'Только завтраки ☕'],
        ['Апартаменты 🏠', 'Бутик-отель'],
        ['Не важно'],
      ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
  },

  // Шаг 12: Бюджет
  async (ctx) => {
    ctx.wizard.state.accommodation = ctx.message.text;
    await ctx.reply(
      'Укажите бюджет на человека:',
      Markup.keyboard([
        ['До 50 000 ₽', '50 000 - 100 000 ₽'],
        ['100 000 - 200 000 ₽', '200 000+ ₽'],
      ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
  },

  // Шаг 13: Контакты
  async (ctx) => {
    ctx.wizard.state.budget = ctx.message.text;
    await ctx.reply('Как к вам обращаться?');
    return ctx.wizard.next();
  },

  // Шаг 14: Телефон
  async (ctx) => {
    ctx.wizard.state.name = ctx.message.text;

    // Клавиатура для запроса телефона
    const contactKeyboard = {
      keyboard: [
        [
          {
            text: '📞 Отправить телефон',
            request_contact: true,
          },
        ],
        ['Пропустить'],
      ],
      resize_keyboard: true,
    };

    await ctx.reply(
      'Оставьте телефон для связи 📱',
      Markup.keyboard(contactKeyboard.keyboard).resize()
    );

    return ctx.wizard.next();
  },

  // Шаг 15: Финализация
  async (ctx) => {
    // Обработка контакта или текста
    if (ctx.message.contact) {
      ctx.wizard.state.phone = ctx.message.contact.phone_number;
    } else if (ctx.message.text && ctx.message.text !== 'Пропустить') {
      ctx.wizard.state.phone = ctx.message.text;
    }

    // Формирование заявки
    const userData = ctx.wizard.state;
    const application = `
🌟 *Новая заявка на подбор тура!* 🌟

*Имя:* ${userData.name}
${userData.phone ? `*Телефон:* ${userData.phone}\n` : ''}
*Город вылета:* ${userData.city}
*Направление:* ${userData.destination}
*Период:* ${userData.travelPeriod || 'Не указано'}
${
  userData.departureDate
    ? `*Даты:* ${userData.departureDate} - ${userData.returnDate}\n`
    : ''
}
*Ночей:* ${userData.nights}
*Состав группы:* ${userData.companions}
${userData.childrenInfo ? `*Дети:* ${userData.childrenInfo}\n` : ''}
*Тип отдыха:* ${userData.tourType}
*Размещение:* ${userData.accommodation}
*Бюджет:* ${userData.budget}
    `;

    try {
      // Отправка заявки администратору по chat_id
      const adminChatId = process.env.ADMIN_CHAT_ID;
      if (!adminChatId) {
        throw new Error('ADMIN_CHAT_ID не указан в .env');
      }

      // Преобразуем chat_id в число
      const chatId = parseInt(adminChatId);

      await ctx.telegram.sendMessage(chatId, application, {
        parse_mode: 'Markdown',
      });

      // Подтверждение пользователю
      let confirmation = `Спасибо, ${userData.name}! 🎉\nВаши данные получены!`;

      if (userData.phone) {
        confirmation += `\nМы свяжемся с вами по номеру ${userData.phone} в ближайшее время.`;
      } else {
        confirmation += `\nНаш менеджер свяжется с вами в Telegram для уточнения деталей.`;
      }

      await ctx.reply(confirmation, Markup.removeKeyboard());

      logger.log(`Новая заявка от ${userData.name}`, 'APPLICATION');
    } catch (error) {
      logger.error('Ошибка отправки заявки', 'BOT', error);
      let errorMessage = '❌ Произошла ошибка при обработке заявки. ';

      if (error.description && error.description.includes('chat not found')) {
        errorMessage += 'Пожалуйста, проверьте настройки ADMIN_CHAT_ID в .env';
      } else {
        errorMessage += 'Попробуйте позже или свяжитесь с нами напрямую.';
      }

      await ctx.reply(errorMessage);
    }

    return ctx.scene.leave();
  }
);

// // Команда для получения chat_id
// bot.command('myid', (ctx) => {
//   const chatId = ctx.chat.id;

//   // Форматируем сообщение с экранированием
//   const message = `
// Ваш chat_id: \`${chatId}\`
// Добавьте его в файл \\.env как ADMIN_CHAT_ID
// Пример:
// ADMIN_CHAT_ID=${chatId}
//   `.trim();

//   ctx.reply(message, { parse_mode: 'MarkdownV2' });

//   logger.log(
//     `Пользователь ${ctx.from.id} запросил свой chat_id: ${chatId}`,
//     'USER'
//   );
// });

// Настройка сцен
const stage = new Stage([tourQuestionnaire]);
bot.use(stage.middleware());

// Команда старта
bot.start((ctx) => {
  logger.log(`Пользователь ${ctx.from.id} запустил бота`, 'USER');
  return ctx.scene.enter('TOUR_QUESTIONNAIRE');
});

// Команда запуска опросника
bot.command('tour', (ctx) => ctx.scene.enter('TOUR_QUESTIONNAIRE'));

// Обработчик текстовых сообщений (на случай, если пользователь заблудился)
bot.on('text', (ctx) => {
  if (!ctx.scene.current) {
    ctx.reply(
      'Для подбора тура нажмите /start или /tour',
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
