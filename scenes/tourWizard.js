const { Scenes, Markup } = require('telegraf');
const departureCities = require('../const/mapDeparture');
const destinationCountries = require('../const/mapCountry');
const processHotelData = require('../utils/sortHotel');
const { logStep } = require('../utils/logger');
const { withStuckWatcher } = require('../middlewares/stuckWatcher');

// Функция для логирования

const tourQuestionnaire = new Scenes.WizardScene(
  'TOUR_QUESTIONNAIRE',
  ...withStuckWatcher([
    // Шаг 0: Приветствие
    async (ctx) => {
      // показываем приветствие и кнопку
      await ctx.reply(
        `Привет, ${
          ctx.from.first_name || 'путешественник'
        }! 👋\nЯ помогу подобрать идеальный тур! Ответь на несколько вопросов:`,
        Markup.inlineKeyboard([
          Markup.button.callback('Начать опрос ▶️', 'start_survey'),
        ])
      );
      // ВАЖНО: остаёмся на шаге 0 и ждём нажатие кнопки
      return ctx.wizard.next();
    },

    // Шаг 1: Проверка старта
    async (ctx) => {
      if (
        ctx.updateType === 'callback_query' &&
        ctx.callbackQuery.data === 'start_survey'
      ) {
        await ctx.answerCbQuery();

        try {
          await ctx.deleteMessage();
        } catch (e) {
          console.warn('Не удалось удалить сообщение:', e.message);
        }

        await ctx.reply(
          'Отлично! Приступаем к опросу.',
          Markup.removeKeyboard()
        );

        const cityButtons = Object.keys(departureCities);
        await ctx.reply(
          '1/11: Выберите город вылета из списка: 🏙️',
          Markup.keyboard(cityButtons).resize().oneTime()
        );

        return ctx.wizard.next();
      }

      return; // если прилетело что-то другое
    },
    // Шаг 2: Город вылета (выбор из списка)
    async (ctx) => {
      const selectedCity = ctx.message.text;

      // Проверяем, есть ли город в списке
      if (!departureCities.hasOwnProperty(selectedCity)) {
        const cityButtons = Object.keys(departureCities);
        await ctx.reply(
          '❌ Пожалуйста, выберите город из списка:',
          Markup.keyboard(cityButtons).resize().oneTime()
        );
        return { success: false };
      }

      // Сохраняем ID и название города
      ctx.wizard.state.departureCity = {
        id: departureCities[selectedCity],
        name: selectedCity,
      };
      // Создаем кнопки со странами
      const countryButtons = Object.keys(destinationCountries);

      await ctx.reply(`✅ Выбрано: ${selectedCity}`, Markup.removeKeyboard());
      await ctx.reply(
        '2/11: В какую страну хотите поехать? 🌍',
        Markup.keyboard(countryButtons).resize().oneTime()
      );
      return ctx.wizard.next();
    },
    // Шаг 3: Страна отдыха
    async (ctx) => {
      // Проверяем, есть ли в сообщении текст, который есть в списке стран
      const selectedCountry = ctx.message.text;
      // Создаем кнопки со странами
      const countryButtons = Object.keys(destinationCountries);

      // Если сообщение не является строкой из списка стран, то просим выбрать
      if (!destinationCountries.hasOwnProperty(selectedCountry)) {
        await ctx.reply(
          '❌ Пожалуйста, выберите страну из списка:',
          Markup.keyboard(countryButtons).resize().oneTime()
        );
        return { success: false };
      }

      // Сохраняем ID и название страны
      ctx.wizard.state.destinationCountry = {
        id: destinationCountries[selectedCountry],
        name: selectedCountry,
      };

      await ctx.reply(
        `✅ Выбрано: ${selectedCountry}`,
        Markup.removeKeyboard()
      );
      await ctx.reply(
        '3/11: 📅 Укажите дату вылета (формат ДД.ММ.ГГГГ) или период (ДД.ММ.ГГГГ - ДД.ММ.ГГГГ):\n' +
          'Примеры:\n15.08.2024\n10.08.2024 - 20.08.2024'
      );
      return ctx.wizard.next();
    },
    // Шаг 4: Дата вылета (конкретная дата или период)
    async (ctx) => {
      const input = ctx.message.text.trim();

      // Проверка формата: конкретная дата или период
      const singleDateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
      const periodRegex = /^\d{2}\.\d{2}\.\d{4}\s*-\s*\d{2}\.\d{2}\.\d{4}$/;

      let startDate, endDate;

      // Проверка на конкретную дату
      if (singleDateRegex.test(input)) {
        const [day, month, year] = input.split('.').map(Number);
        const date = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (
          isNaN(date) ||
          date.getDate() !== day ||
          date.getMonth() !== month - 1 ||
          date.getFullYear() !== year
        ) {
          await ctx.reply(
            '❌ Некорректная дата. Проверьте правильность ввода:'
          );
          return { success: false };
        }

        if (date < today) {
          await ctx.reply(
            '❌ Дата вылета не может быть в прошлом. Введите будущую дату:'
          );
          return { success: false };
        }

        // Сохраняем как период с одинаковыми датами
        startDate = input;
        endDate = input;
      }
      // Проверка на период
      else if (periodRegex.test(input)) {
        const [startStr, endStr] = input.split('-').map((s) => s.trim());
        const [startDay, startMonth, startYear] = startStr
          .split('.')
          .map(Number);
        const [endDay, endMonth, endYear] = endStr.split('.').map(Number);

        startDate = new Date(startYear, startMonth - 1, startDay);
        endDate = new Date(endYear, endMonth - 1, endDay);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Проверка валидности дат
        if (
          isNaN(startDate) ||
          startDate.getDate() !== startDay ||
          startDate.getMonth() !== startMonth - 1 ||
          startDate.getFullYear() !== startYear ||
          isNaN(endDate) ||
          endDate.getDate() !== endDay ||
          endDate.getMonth() !== endMonth - 1 ||
          endDate.getFullYear() !== endYear
        ) {
          await ctx.reply(
            '❌ Одна из дат некорректна. Проверьте правильность ввода:'
          );
          return { success: false };
        }

        if (startDate < today) {
          await ctx.reply('❌ Начальная дата периода не может быть в прошлом:');
          return { success: false };
        }

        if (startDate > endDate) {
          await ctx.reply(
            '❌ Конечная дата периода не может быть раньше начальной:'
          );
          return { success: false };
        }

        // Форматируем обратно в строки
        startDate = startStr;
        endDate = endStr;
      }
      // Неверный формат
      else {
        await ctx.reply(
          '❌ Неверный формат. Используйте:\n' +
            '- Конкретную дату (ДД.ММ.ГГГГ)\n' +
            '- Или период (ДД.ММ.ГГГГ - ДД.ММ.ГГГГ)\n\n' +
            'Примеры:\n15.08.2024\n10.08.2024 - 20.08.2024'
        );
        return { success: false };
      }

      // Всегда сохраняем как период
      ctx.wizard.state.departureDate = {
        start: startDate,
        end: endDate,
      };

      await ctx.reply('4/11: Сколько ночей планируете отдыхать? 🌙');
      return ctx.wizard.next();
    },
    // Шаг 5: Количество ночей
    async (ctx) => {
      const nights = parseInt(ctx.message.text);

      if (isNaN(nights) || nights < 1 || nights > 365) {
        await ctx.reply('❌ Введите корректное число (от 1 до 365):');
        return { success: false };
      }

      ctx.wizard.state.nights = nights;
      await ctx.reply('5/11: Укажите количество взрослых:');
      return ctx.wizard.next();
    },
    // Шаг 6: Количество взрослых
    async (ctx) => {
      const adults = parseInt(ctx.message.text);

      if (isNaN(adults) || adults < 1 || adults > 20) {
        await ctx.reply('❌ Введите число от 1 до 20:');
        return { success: false };
      }

      ctx.wizard.state.adults = adults;

      // Кнопки для детей
      await ctx.reply(
        '6/11: Сколько будет детей?',
        Markup.keyboard([['1', '2', '3'], ['Нет детей']])
          .resize()
          .oneTime()
      );
      return ctx.wizard.next();
    },
    // Шаг 7: Количество детей
    async (ctx) => {
      // Обработка ввода возраста детей (если уже начат сбор возрастов)
      if (ctx.wizard.state.childrenAges) {
        const age = parseInt(ctx.message.text);

        // Проверка корректности возраста
        if (isNaN(age) || age < 0 || age > 15) {
          await ctx.reply(
            '❌ Возраст должен быть от 0 до 15 лет. Укажите снова:'
          );
          return { success: false };
        }

        // Сохранение возраста и обновление индекса
        ctx.wizard.state.childrenAges.push(age);
        ctx.wizard.state.currentChildIndex++;

        // Проверка остались ли дети
        if (ctx.wizard.state.currentChildIndex < ctx.wizard.state.children) {
          await ctx.reply(
            `Укажите возраст ребенка №${
              ctx.wizard.state.currentChildIndex + 1
            }:`,
            Markup.removeKeyboard() // Скрыть предыдущую клавиатуру
          );
          return;
        }

        // Все возрасты получены - продолжаем
        await ctx.reply('✅ Возраста детей сохранены');
        delete ctx.wizard.state.currentChildIndex; // Очистка временных данных

        // Показ кнопок для выбора класса отеля
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
      }

      // Обработка начального ввода (количество детей)
      if (ctx.message.text === 'Нет детей') {
        ctx.wizard.state.children = 0;
      } else {
        const children = parseInt(ctx.message.text);

        // Проверка корректности числа детей
        if (isNaN(children) || children < 0 || children > 10) {
          await ctx.reply(
            '❌ Выберите вариант из кнопок:',
            Markup.keyboard([['1', '2', '3'], ['Нет детей']])
              .resize()
              .oneTime()
          );
          return { success: false };
        }
        ctx.wizard.state.children = children;
      }

      // Если дети есть - начинаем сбор возрастов
      if (ctx.wizard.state.children > 0) {
        ctx.wizard.state.childrenAges = [];
        ctx.wizard.state.currentChildIndex = 0;

        await ctx.reply(
          `Укажите возраст ребенка №1:`,
          Markup.removeKeyboard() // Скрыть клавиатуру с количеством детей
        );
        return; // Остаемся в этом же шаге
      }

      // Если детей нет - сразу переходим к выбору отеля
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
        return { success: false };
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
        return { success: false };
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
        return { success: false };
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
        return { success: false };
      }

      ctx.wizard.state.hotelRating = ctx.message.text;
      await ctx.reply(
        '11/11: Укажите бюджет в рублях (формат: "от ДО"):\nПример: от 50000 до 150000'
      );
      return ctx.wizard.next();
    },
    // Шаг 12: Бюджет
    async (ctx) => {
      const budgetRegex = /^от\s*(\d+)\s*до\s*(\d+)$/i;
      const match = ctx.message.text.match(budgetRegex);

      if (!match) {
        await ctx.reply(
          '❌ Используйте формат: "от ДО"\nПример: от 50000 до 150000'
        );
        return { success: false };
      }

      const min = parseInt(match[1]);
      const max = parseInt(match[2]);

      if (isNaN(min) || isNaN(max)) {
        await ctx.reply('❌ Введите числа в формате: от 50000 до 150000');
        return { success: false };
      }

      if (min > max || min < 0 || max < 0) {
        await ctx.reply(
          '❌ Некорректный диапазон. Минимум должен быть меньше максимума'
        );
        return { success: false };
      }

      ctx.wizard.state.budget = { min, max };

      // Сбор данных и отправка
      const userData = ctx.wizard.state;
      const application = `
🌟 *НОВАЯ ЗАЯВКА НА ТУР* 🌟
      
📍 *Город вылета:* ${userData.departureCity.name} (ID: ${
        userData.departureCity.id
      })
🌍 *Страна отдыха:* ${userData.destinationCountry.name} (ID: ${
        userData.destinationCountry.id
      })
📅 *Дата вылеты:* ${userData.departureDate?.start} - ${
        userData.departureDate?.end
      }
🌙 *Ночей:* ${userData.nights}
👨‍👩‍👧 *Путешественники:* ${userData.adults} взрослых, ${
        userData.children || 0
      } детей
🏨 *Отель:* ${userData.hotelClass || '-'}, ${userData.hotelType || '-'}
🍽️ *Питание:* ${userData.mealType || '-'}
⭐ *Рейтинг:* ${userData.hotelRating || '-'}
💰 *Бюджет:* от ${userData.budget.min} до ${userData.budget.max} руб.
    `;
      await ctx.reply(
        '✅ Спасибо! Ваши данные отправлены менеджеру.\nХотите заполнить новую заявку?',
        Markup.removeKeyboard() // <-- передаём в reply
      );
      try {
        await ctx.telegram.sendMessage(process.env.ADMIN_CHAT_ID, application, {
          parse_mode: 'Markdown',
        });
      } catch (error) {
        console.error('Ошибка отправки:', error);
        await ctx.reply('❌ Ошибка отправки данных. Попробуйте позже.');
        return { success: false };
      }
      await ctx.reply(
        `✅ Спасибо! Ваши данные отправлены менеджеру.\nХотите заполнить новую заявку?`,
        Markup.inlineKeyboard([
          Markup.button.callback('🔄 Начать заново', 'restart_survey'),
        ])
      );

      return ctx.wizard.selectStep(0);
    },
  ])
);


tourQuestionnaire.use(async (ctx, next) => {
  logStep(ctx, `шаг - ${ctx.wizard.cursor}`);
  
  // Обработка команды /reset
  if (ctx.message?.text === '/reset') {
    ctx.wizard.cursor = 0;
    // Сброс watcher при reset
    if (ctx.session.stuckWatcher) {
      ctx.session.stuckWatcher = {
        retries: {},
        lastStepTimes: {},
        waitingForChoice: false,
        stuckStep: null,
      };
    }
    await ctx.reply('🔄 Сцена перезапущена! Начинаем сначала.');
    return ctx.wizard.steps[0](ctx);
  }

  // Проверка на зависание (добавленная логика)
  if (ctx.session.stuckWatcher?.waitingForChoice && ctx.message) {
    const watcher = ctx.session.stuckWatcher;
    const answer = ctx.message.text;

    if (answer === 'Продолжить ▶️') {
      watcher.waitingForChoice = false;
      const stepKey = `step_${ctx.wizard.cursor}`;
      watcher.retries[stepKey] = 0;
      watcher.lastStepTimes[stepKey] = Date.now();
      // Продолжаем выполнение текущего шага
      return next();
    }

    if (answer === '🔄 Начать заново') {
      ctx.session.stuckWatcher = {
        retries: {},
        lastStepTimes: {},
        waitingForChoice: false,
        stuckStep: null,
      };
      await ctx.scene.leave();
      return ctx.scene.enter('TOUR_QUESTIONNAIRE');
    }

    // Если введен некорректный ответ, ждем дальше
    await ctx.reply('Пожалуйста, выберите один из предложенных вариантов:');
    return;
  }

  await next();
});

module.exports = { tourQuestionnaire };
