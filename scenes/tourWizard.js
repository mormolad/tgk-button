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

  // Шаг 0: Приветствие
  async (ctx) => {
    logStep(ctx, '0 - Приветствие');
    await ctx.reply(
      `Привет, ${
        ctx.from.first_name || 'путешественник'
      }! 👋\nЯ помогу подобрать идеальный тур! Ответь на несколько вопросов:`,
      Markup.keyboard([['Начать опрос ▶️']])
        .resize()
        .oneTime()
    );
    return ctx.wizard.next();
  },

  // Шаг 1: Проверка старта
  async (ctx) => {
    logStep(ctx, '1 - Проверка старта');
    if (ctx.message.text !== 'Начать опрос ▶️') {
      await ctx.reply(
        'Пожалуйста, нажмите кнопку "Начать опрос ▶️"',
        Markup.keyboard([['Начать опрос ▶️']])
          .resize()
          .oneTime()
      );
      return;
    }

    await ctx.reply('Отлично! Приступаем к опросу.', Markup.removeKeyboard());
    await ctx.reply('1/11: Из какого города вылетаете? 🏙️');
    return ctx.wizard.next();
  },

  // Шаг 2: Город вылета
  async (ctx) => {
    logStep(ctx, '2 - Город вылета');
    ctx.wizard.state.departureCity = ctx.message.text;
    await ctx.reply('2/11: В какую страну хотите поехать? 🌍');
    return ctx.wizard.next();
  },

  // Шаг 3: Страна отдыха
  async (ctx) => {
    logStep(ctx, '3 - Страна отдыха');
    ctx.wizard.state.destinationCountry = ctx.message.text;
    await ctx.reply(
      '3/11: 📅 Укажите дату вылета (формат ДД.ММ.ГГГГ):\nПример: 15.08.2024'
    );
    return ctx.wizard.next();
  },

  // Шаг 4: Дата вылета (валидация)
  async (ctx) => {
    logStep(ctx, '4 - Дата вылета');
    const input = ctx.message.text;

    // Валидация даты
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(input)) {
      await ctx.reply(
        '❌ Неверный формат. Используйте ДД.ММ.ГГГГ:\nПример: 20.07.2024'
      );
      return;
    }

    const [day, month, year] = input.split('.').map(Number);

    // Проверка валидности даты
    const date = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (
      isNaN(date.getTime()) ||
      date.getDate() !== day ||
      date.getMonth() !== month - 1 ||
      date.getFullYear() !== year
    ) {
      await ctx.reply('❌ Некорректная дата. Проверьте правильность ввода:');
      return;
    }

    if (date < today) {
      await ctx.reply(
        '❌ Дата вылета не может быть в прошлом. Введите будущую дату:'
      );
      return;
    }

    ctx.wizard.state.departureDate = input;
    await ctx.reply('4/11: Сколько ночей планируете отдыхать? 🌙');
    return ctx.wizard.next();
  },

  // Шаг 5: Количество ночей
  async (ctx) => {
    logStep(ctx, '5 - Количество ночей');
    const nights = parseInt(ctx.message.text);

    if (isNaN(nights) || nights < 1 || nights > 365) {
      await ctx.reply('❌ Введите корректное число (от 1 до 365):');
      return;
    }

    ctx.wizard.state.nights = nights;
    await ctx.reply('5/11: Укажите количество взрослых:');
    return ctx.wizard.next();
  },

  // Шаг 6: Количество взрослых
  async (ctx) => {
    logStep(ctx, '6 - Взрослые');
    const adults = parseInt(ctx.message.text);

    if (isNaN(adults) || adults < 1 || adults > 20) {
      await ctx.reply('❌ Введите число от 1 до 20:');
      return;
    }

    ctx.wizard.state.adults = adults;

    // Кнопки для детей
    await ctx.reply(
      '6/11: Сколько будет детей?',
      Markup.keyboard([
        ['0', '1', '2'],
        ['3', 'Нет детей'],
      ])
        .resize()
        .oneTime()
    );
    return ctx.wizard.next();
  },

  // Шаг 7: Количество детей
  async (ctx) => {
    logStep(ctx, '7 - Дети');
    if (ctx.message.text === 'Нет детей') {
      ctx.wizard.state.children = 0;
    } else {
      const children = parseInt(ctx.message.text);
      if (isNaN(children) || children < 0 || children > 10) {
        await ctx.reply(
          '❌ Выберите вариант из кнопок:',
          Markup.keyboard([
            ['0', '1', '2'],
            ['3', 'Нет детей'],
          ])
            .resize()
            .oneTime()
        );
        return;
      }
      ctx.wizard.state.children = children;
    }

    // Кнопки для звезд отеля
    await ctx.reply(
      '7/11: Выберите класс отеля:',
      Markup.keyboard([
        ['3 ★', '4 ★'],
        ['5 ★', 'Любой'],
      ])
        .resize()
        .oneTime()
    );
    return ctx.wizard.next();
  },

  // Шаг 8: Класс отеля
  async (ctx) => {
    logStep(ctx, '8 - Класс отеля');
    const validOptions = ['3 ★', '4 ★', '5 ★', 'Любой'];

    if (!validOptions.includes(ctx.message.text)) {
      await ctx.reply(
        '❌ Выберите вариант из кнопок:',
        Markup.keyboard([
          ['3 ★', '4 ★'],
          ['5 ★', 'Любой'],
        ])
          .resize()
          .oneTime()
      );
      return;
    }

    ctx.wizard.state.hotelClass = ctx.message.text;

    // Кнопки для типа отеля
    await ctx.reply(
      '8/11: Выберите тип размещения:',
      Markup.keyboard([
        ['Отель', 'Пансионат', 'Гостевой дом'],
        ['Апартаменты', 'Вилла', 'Хостел'],
        ['Любой'],
      ])
        .resize()
        .oneTime()
    );
    return ctx.wizard.next();
  },

  // Шаг 9: Тип отеля
  async (ctx) => {
    logStep(ctx, '9 - Тип отеля');
    const validTypes = [
      'Отель',
      'Пансионат',
      'Гостевой дом',
      'Апартаменты',
      'Вилла',
      'Хостел',
      'Любой',
    ];

    if (!validTypes.includes(ctx.message.text)) {
      await ctx.reply(
        '❌ Выберите вариант из кнопок:',
        Markup.keyboard([
          ['Отель', 'Пансионат', 'Гостевой дом'],
          ['Апартаменты', 'Вилла', 'Хостел'],
          ['Любой'],
        ])
          .resize()
          .oneTime()
      );
      return;
    }

    ctx.wizard.state.hotelType = ctx.message.text;

    // Кнопки для питания
    await ctx.reply(
      '9/11: Выберите тип питания:',
      Markup.keyboard([
        ['Только завтрак', 'Завтрак и ужин'],
        ['Полный пансион', 'Всё включено'],
        ['Ультра всё включено'],
      ])
        .resize()
        .oneTime()
    );
    return ctx.wizard.next();
  },

  // Шаг 10: Тип питания
  async (ctx) => {
    logStep(ctx, '10 - Тип питания');
    const validMeals = [
      'Только завтрак',
      'Завтрак и ужин',
      'Полный пансион',
      'Всё включено',
      'Ультра всё включено',
    ];

    if (!validMeals.includes(ctx.message.text)) {
      await ctx.reply(
        '❌ Выберите вариант из кнопок:',
        Markup.keyboard([
          ['Только завтрак', 'Завтрак и ужин'],
          ['Полный пансион', 'Всё включено'],
          ['Ультра всё включено'],
        ])
          .resize()
          .oneTime()
      );
      return;
    }

    ctx.wizard.state.mealType = ctx.message.text;

    // Кнопки для рейтинга
    await ctx.reply(
      '10/11: Минимальный рейтинг отеля:',
      Markup.keyboard([
        ['3.0+', '3.5+'],
        ['4.0+', '4.5+'],
      ])
        .resize()
        .oneTime()
    );
    return ctx.wizard.next();
  },

  // Шаг 11: Рейтинг отеля
  async (ctx) => {
    logStep(ctx, '11 - Рейтинг');
    const validRatings = ['3.0+', '3.5+', '4.0+', '4.5+'];

    if (!validRatings.includes(ctx.message.text)) {
      await ctx.reply(
        '❌ Выберите вариант из кнопок:',
        Markup.keyboard([
          ['3.0+', '3.5+'],
          ['4.0+', '4.5+'],
        ])
          .resize()
          .oneTime()
      );
      return;
    }

    ctx.wizard.state.hotelRating = ctx.message.text;
    await ctx.reply(
      '11/11: Укажите бюджет в рублях (формат: "от ДО"):\nПример: от 50000 до 150000'
    );
    return ctx.wizard.next();
  },

  // Шаг 12: Бюджет
  async (ctx) => {
    logStep(ctx, '12 - Бюджет');
    const budgetRegex = /^от\s*(\d+)\s*до\s*(\d+)$/i;
    const match = ctx.message.text.match(budgetRegex);

    if (!match) {
      await ctx.reply(
        '❌ Используйте формат: "от ДО"\nПример: от 50000 до 150000'
      );
      return;
    }

    const min = parseInt(match[1]);
    const max = parseInt(match[2]);

    if (isNaN(min) || isNaN(max)) {
      await ctx.reply('❌ Введите числа в формате: от 50000 до 150000');
      return;
    }

    if (min > max || min < 0 || max < 0) {
      await ctx.reply(
        '❌ Некорректный диапазон. Минимум должен быть меньше максимума'
      );
      return;
    }

    ctx.wizard.state.budget = { min, max };

    // Сбор данных и отправка
    const userData = ctx.wizard.state;
    const application = `
🌟 *НОВАЯ ЗАЯВКА НА ТУР* 🌟
      
📍 *Город вылета:* ${userData.departureCity}
🌍 *Страна отдыха:* ${userData.destinationCountry}
📅 *Дата вылета:* ${userData.departureDate}
🌙 *Ночей:* ${userData.nights}
👨‍👩‍👧 *Путешественники:* ${userData.adults} взрослых, ${
      userData.children || 0
    } детей
🏨 *Отель:* ${userData.hotelClass || '-'}, ${userData.hotelType || '-'}
🍽️ *Питание:* ${userData.mealType || '-'}
⭐ *Рейтинг:* ${userData.hotelRating || '-'}
💰 *Бюджет:* от ${userData.budget.min} до ${userData.budget.max} руб.
    `;

    try {
      await ctx.telegram.sendMessage(process.env.ADMIN_CHAT_ID, application, {
        parse_mode: 'Markdown',
      });

      await ctx.reply(
        `✅ Спасибо! Ваши данные отправлены менеджеру.\nОжидайте предложений в ближайшее время!`,
        Markup.removeKeyboard()
      );
    } catch (error) {
      console.error('Ошибка отправки:', error);
      await ctx.reply('❌ Ошибка отправки данных. Попробуйте позже.');
    }

    return ctx.scene.leave();
  }
);

module.exports = { tourQuestionnaire };
