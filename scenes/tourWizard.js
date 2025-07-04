const { Scenes, Markup } = require('telegraf');

// Функция для логирования
const logStep = (ctx, stepName) => {
  const userId = ctx.from.id;
  const username = ctx.from.username
    ? `@${ctx.from.username}`
    : ctx.from.first_name;
  const state = JSON.stringify(ctx.wizard.state, null, 2);

  console.log(`\n--- Шаг ${stepName} ---`);
  console.log(`Пользователь: ${username} (ID: ${userId})`);
  console.log(`Сообщение: ${ctx.message.text || 'Нет текста'}`);
  console.log(`Состояние:`, state);
  console.log('----------------------');
};

const tourQuestionnaire = new Scenes.WizardScene(
  'TOUR_QUESTIONNAIRE',

  // Шаг 1: Приветствие и начало
  async (ctx) => {
    logStep(ctx, '1 - Приветствие');
    await ctx.reply(
      `Привет, ${
        ctx.from.first_name || 'путешественник'
      }! 👋\nЯ твой персональный помощник. Ответь на несколько вопросов, и я найду идеальный вариант для тебя!`,
      Markup.keyboard([['Начать опрос ▶️']])
        .resize()
        .oneTime()
    );
    return ctx.wizard.next();
  },

  // Шаг 2: Проверка нажатия кнопки
  async (ctx) => {
    if (ctx.message.text !== 'Начать опрос ▶️') {
      await ctx.reply(
        'Пожалуйста, нажмите кнопку "Начать опрос ▶️" для продолжения',
        Markup.keyboard([['Начать опрос ▶️']])
          .resize()
          .oneTime()
      );
      return;
    }

    await ctx.reply('Отлично! Приступаем к опросу.', Markup.removeKeyboard());
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

    // Сохраняем клавиатуру в состоянии для повторного использования
    ctx.wizard.state.dateKeyboard = Markup.keyboard([
      ['Конкретные даты'],
      ['Июль-Август ☀️', 'Сентябрь-Октябрь 🍂'],
      ['Ноябрь-Март ❄️', 'Апрель-Июнь 🌸'],
    ])
      .oneTime()
      .resize();

    await ctx.reply(
      'Когда планируете путешествие? 📅',
      ctx.wizard.state.dateKeyboard
    );
    return ctx.wizard.next();
  },

  // Шаг 5: Обработка выбора дат
  async (ctx) => {
    logStep(ctx, '5 - Период путешествия');

    // Проверяем, выбран ли один из периодов
    const periods = [
      'Июль-Август ☀️',
      'Сентябрь-Октябрь 🍂',
      'Ноябрь-Март ❄️',
      'Апрель-Июнь 🌸',
    ];

    if (periods.includes(ctx.message.text)) {
      // Сохраняем выбранный период
      ctx.wizard.state.travelPeriod = ctx.message.text;

      // Переходим к вопросу о количестве ночей
      await ctx.reply(
        `Выбрано: ${ctx.message.text}\n\nНа сколько ночей планируете? 🌙`,
        Markup.keyboard([
          ['7-10 ночей', '10-14 ночей'],
          ['2 недели+', 'Короткий тур (3-5 ночей)'],
        ])
          .oneTime()
          .resize()
      );
      return ctx.wizard.selectStep(7); // Переход к шагу 7 (количество ночей)
    }

    // Обработка конкретных дат
    if (ctx.message.text === 'Конкретные даты') {
      await ctx.reply('Введите дату вылета (ДД.ММ.ГГГГ):');
      return ctx.wizard.next();
    }

    // Если ввод не распознан
    await ctx.reply(
      'Пожалуйста, выберите один из предложенных вариантов:',
      ctx.wizard.state.dateKeyboard
    );
    return; // Остаемся на текущем шаге
  },

  // Шаг 6: Обработка конкретных дат
  async (ctx) => {
    logStep(ctx, '6 - Конкретные даты (вылет)');

    if (!/\d{2}\.\d{2}\.\d{4}/.test(ctx.message.text)) {
      await ctx.reply('Пожалуйста, введите дату в формате ДД.ММ.ГГГГ');
      return;
    }

    ctx.wizard.state.departureDate = ctx.message.text;
    await ctx.reply('Введите дату возвращения (ДД.ММ.ГГГГ):');
    return ctx.wizard.next();
  },

  // Шаг 7: Количество ночей (объединенный шаг)
  async (ctx) => {
    logStep(ctx, '7 - Количество ночей');

    // Если пришли из обработки конкретных дат
    if (ctx.wizard.state.departureDate) {
      // Валидация даты возвращения
      if (!/\d{2}\.\d{2}\.\d{4}/.test(ctx.message.text)) {
        await ctx.reply('Пожалуйста, введите дату в формате ДД.ММ.ГГГГ');
        return;
      }
      ctx.wizard.state.returnDate = ctx.message.text;

      // Рассчитываем количество ночей
      const start = new Date(
        ctx.wizard.state.departureDate.split('.').reverse().join('-')
      );
      const end = new Date(ctx.message.text.split('.').reverse().join('-'));
      const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      ctx.wizard.state.nights = `${nights} ночей`;

      await ctx.reply(
        `Период путешествия: ${nights} ночей\n\nС кем путешествуете? 👨‍👩‍👧‍👦`,
        Markup.keyboard([
          ['Один/одна', 'Пара/Вдвоём'],
          ['С детьми 👶', 'С друзьями'],
          ['Семья (взрослые)', 'Группа (6+ человек)'],
        ])
          .oneTime()
          .resize()
      );
      return ctx.wizard.next();
    }

    // Если пришли из выбора периода
    ctx.wizard.state.nights = ctx.message.text;
    await ctx.reply(
      `На сколько ночей: ${ctx.message.text}\n\nС кем путешествуете? 👨‍👩‍👧‍👦`,
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

  // Шаг 8: Количество ночей (обработка)
  async (ctx) => {
    logStep(ctx, '8 - Количество ночей');
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
    logStep(ctx, '9 - Состав группы');
    ctx.wizard.state.companions = ctx.message.text;

    if (
      ctx.message.text.includes('детьми') ||
      ctx.message.text.includes('Группа')
    ) {
      await ctx.reply(
        'Сколько будет детей и их возраст? (Пример: 1 ребёнок 5 лет, 2 ребёнка 8 и 10 лет)'
      );
      return ctx.wizard.next();
    }

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
    return ctx.wizard.selectStep(12);
  },

  // Шаг 10: Информация о детях
  async (ctx) => {
    logStep(ctx, '10 - Информация о детях');
    ctx.wizard.state.childrenInfo = ctx.message.text;

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

  // Шаг 12: Размещение
  async (ctx) => {
    logStep(ctx, '12 - Бюджет');
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

  // Шаг 13: Бюджет
  async (ctx) => {
    logStep(ctx, '13 - Бюджет');
    ctx.wizard.state.budget = ctx.message.text;

    await ctx.reply('Как к вам обращаться?');
    return ctx.wizard.next();
  },

  // Шаг 14: Контакты
  async (ctx) => {
    logStep(ctx, '14 - Имя пользователя');
    ctx.wizard.state.name = ctx.message.text;

    const contactKeyboard = Markup.keyboard([
      [Markup.button.contactRequest('📞 Отправить телефон')],
      ['Пропустить'],
    ]).resize();

    await ctx.reply('Оставьте телефон для связи 📱', contactKeyboard);
    return ctx.wizard.next();
  },

  // Шаг 15: Финализация
  async (ctx) => {
    logStep(ctx, '15 - Контактная информация');

    if (ctx.message.contact) {
      ctx.wizard.state.phone = ctx.message.contact.phone_number;
    } else if (ctx.message.text && ctx.message.text !== 'Пропустить') {
      ctx.wizard.state.phone = ctx.message.text;
    }

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
*Размещение:* ${userData.accommodation}
*Бюджет:* ${userData.budget}
    `;

    try {
      await ctx.telegram.sendMessage(process.env.ADMIN_CHAT_ID, application, {
        parse_mode: 'Markdown',
      });

      let confirmation = `Спасибо, ${userData.name}! 🎉\nВаши данные получены!`;
      confirmation += userData.phone
        ? `\nМы свяжемся с вами по номеру ${userData.phone} в ближайшее время.`
        : `\nНаш менеджер свяжется с вами в Telegram для уточнения деталей.`;

      await ctx.reply(confirmation, Markup.removeKeyboard());
    } catch (error) {
      console.error('Ошибка отправки заявки:', error);
      let errorMessage = '❌ Произошла ошибка при обработке заявки. ';

      if (error.description && error.description.includes('chat not found')) {
        errorMessage += 'Пожалуйста, проверьте настройки ADMIN_CHAT_ID в .env';
      } else {
        errorMessage += 'Попробуйте позже или свяжитесь с нами напрямую.';
      }

      await ctx.reply(errorMessage);
    }

    console.log('=== ЗАВЕРШЕНИЕ ОПРОСА ===');
    console.log(`Пользователь: ${ctx.from.first_name} (ID: ${ctx.from.id})`);
    console.log(
      'Финальное состояние:',
      JSON.stringify(ctx.wizard.state, null, 2)
    );
    console.log('=========================');

    return ctx.scene.leave();
  }
);

module.exports = { tourQuestionnaire };
