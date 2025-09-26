const { Scenes, Markup } = require('telegraf');
const departureCities = require('../const/mapDeparture');
const destinationCountries = require('../const/mapCountry');
const processHotelData = require('../utils/sortHotel');
const { logStep } = require('../utils/logger');
const { withStuckWatcher } = require('../middlewares/stuckWatcher');
const generateCalendar = require('../utils/generateCalendar');

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

        // Предустановленные города
        const topCities = [
          'Иркутск',
          'Красноярск',
          'Новосибирск',
          'Москва',
          'Екатеринбург',
          'Сочи',
          'Казань',
        ];

        const buttons = topCities.map((city) =>
          Markup.button.callback(city, `city_${city}`)
        );

        // Добавляем кнопку "Показать все"
        buttons.push(
          Markup.button.callback('📋 Показать все города', 'show_all_cities')
        );

        await ctx.reply(
          '1/11: Выберите город вылета из списка: 🏙️',
          Markup.inlineKeyboard(buttons, { columns: 2 })
        );

        return ctx.wizard.next();
      }

      return; // если прилетело что-то другое
    },
    // Шаг 2: Город вылета (выбор из списка)
    async (ctx) => {
      if (ctx.updateType === 'callback_query') {
        const data = ctx.callbackQuery.data;

        // Показать все города
        if (data === 'show_all_cities') {
          await ctx.answerCbQuery();

          const cityButtons = Object.keys(departureCities).map((city) =>
            Markup.button.callback(city, `city_${city}`)
          );

          await ctx.editMessageText(
            'Выберите город из списка: 🏙️',
            Markup.inlineKeyboard(cityButtons, { columns: 2 })
          );
          return; // остаёмся в этом же шаге
        }

        // Выбор города
        if (data.startsWith('city_')) {
          const selectedCity = data.replace('city_', '');
          await ctx.answerCbQuery();

          ctx.wizard.state.departureCity = {
            id: departureCities[selectedCity],
            name: selectedCity,
          };

          await ctx.editMessageText(`✅ Выбрано: ${selectedCity}`);

          // Топовые страны
          const topCountries = [
            'Турция',
            'Египет',
            'Таиланд',
            'Вьетнам',
            'Китай',
            'Шри-Ланка',
            'ОАЭ',
            'Мальдивы',
            'Абхазия',
            'Индонезия',
            'Индия',
          ];

          const countryButtons = topCountries.map((c) =>
            Markup.button.callback(c, `country_${c}`)
          );

          // Добавляем кнопку "Показать все"
          countryButtons.push(
            Markup.button.callback(
              '📋 Показать все страны',
              'show_all_countries'
            )
          );

          await ctx.reply(
            '2/11: В какую страну хотите поехать? 🌍',
            Markup.inlineKeyboard(countryButtons, { columns: 2 })
          );

          return ctx.wizard.next();
        }
      }

      return;
    },
    // Шаг 3: выбор страны
    async (ctx) => {
      if (ctx.updateType === 'callback_query') {
        const data = ctx.callbackQuery.data;
        await ctx.answerCbQuery();

        if (data === 'show_all_countries') {
          const allCountryButtons = Object.keys(destinationCountries).map((c) =>
            Markup.button.callback(c, `country_${c}`)
          );

          await ctx.editMessageText(
            'Выберите страну из полного списка: 🌍',
            Markup.inlineKeyboard(allCountryButtons, { columns: 2 })
          );
          return; // остаёмся в шаге 3
        }

        if (data.startsWith('country_')) {
          const selectedCountry = data.replace('country_', '').trim();

          if (!destinationCountries[selectedCountry]) {
            await ctx.reply('❌ Такой страны нет в списке. Попробуйте снова.');
            return;
          }

          ctx.wizard.state.destinationCountry = {
            id: destinationCountries[selectedCountry],
            name: selectedCountry,
          };

          await ctx.editMessageText(
            `✅ Выбрано направление: ${selectedCountry}`,
            { reply_markup: { inline_keyboard: [] } }
          );

          // Показать календарь
          const today = new Date();
          await ctx.reply(
            '3/11: Выберите дату вылета 📅',
            generateCalendar(today.getFullYear(), today.getMonth())
          );

          return ctx.wizard.next(); // → шаг 4
        }
      }
    },

    // Шаг 4: выбор даты
    async (ctx) => {
      if (ctx.updateType === 'callback_query') {
        const data = ctx.callbackQuery.data;
        await ctx.answerCbQuery();

        if (data.startsWith('date_')) {
          const selectedDate = data.replace('date_', '');
          ctx.wizard.state.departureDate = { start: selectedDate };

          await ctx.editMessageText(`✅ Дата вылета: ${selectedDate}`);

          const nightButtons = [
            Markup.button.callback('6-8 🌙', 'nights_6-8'),
            Markup.button.callback('9-11 🌙', 'nights_9-11'),
            Markup.button.callback('12-14 🌙', 'nights_12-14'),
            Markup.button.callback('15-21 🌙', 'nights_15-21'),
          ];

          await ctx.reply(
            '4/11: Выберите количество ночей:',
            Markup.inlineKeyboard(nightButtons, { columns: 2 })
          );
          return ctx.wizard.next(); // → шаг 5
        }
      }
    },

    // Шаг 5: выбор количества ночей
    async (ctx) => {
      if (ctx.updateType === 'callback_query') {
        const data = ctx.callbackQuery.data;
        await ctx.answerCbQuery();

        if (data.startsWith('nights_')) {
          const nightsRange = data.replace('nights_', '');
          ctx.wizard.state.nights = nightsRange;

          await ctx.editMessageText(`✅ Количество ночей: ${nightsRange}`);

          const adultButtons = [
            Markup.button.callback('👤 1', 'adults_1'),
            Markup.button.callback('👤 2', 'adults_2'),
            Markup.button.callback('👤 3', 'adults_3'),
            Markup.button.callback('👤 4', 'adults_4'),
            Markup.button.callback('👤 5', 'adults_5'),
            Markup.button.callback('👤 6', 'adults_6'),
          ];

          await ctx.reply(
            '5/11: Выберите количество взрослых:',
            Markup.inlineKeyboard(adultButtons, { columns: 3 })
          );
          return ctx.wizard.next(); // → шаг 6
        }
      }
    },

    // Шаг 6: количество взрослых
    async (ctx) => {
      if (ctx.updateType === 'callback_query') {
        const data = ctx.callbackQuery.data;
        await ctx.answerCbQuery();

        if (data.startsWith('adults_')) {
          const adults = parseInt(data.replace('adults_', ''));
          ctx.wizard.state.adults = adults;

          await ctx.editMessageText(`✅ Количество взрослых: ${adults}`);

          const childButtons = [
            Markup.button.callback('👶 1', 'children_1'),
            Markup.button.callback('👶 2', 'children_2'),
            Markup.button.callback('👶 3', 'children_3'),
            Markup.button.callback('👶 4', 'children_4'),
            Markup.button.callback('❌ Нет детей', 'children_0'),
          ];

          await ctx.reply(
            '6/11: Сколько будет детей?',
            Markup.inlineKeyboard(childButtons, { columns: 3 })
          );
          return ctx.wizard.next();
        }
      }
    },

    // Шаг 7: Количество детей
    async (ctx) => {
      let input;

      if (ctx.updateType === 'callback_query') {
        input = ctx.callbackQuery.data; // из inline-кнопки
        await ctx.answerCbQuery();
      } else if (ctx.message && ctx.message.text) {
        input = ctx.message.text; // из reply-клавиатуры
      } else {
        return; // ничего не делаем
      }

      // Если мы уже собираем возраста
      if (ctx.wizard.state.childrenAges) {
        const age = parseInt(input);

        if (isNaN(age) || age < 0 || age > 15) {
          await ctx.reply(
            '❌ Возраст должен быть от 0 до 15 лет. Укажите снова:'
          );
          return { success: false };
        }

        ctx.wizard.state.childrenAges.push(age);
        ctx.wizard.state.currentChildIndex++;

        if (ctx.wizard.state.currentChildIndex < ctx.wizard.state.children) {
          await ctx.reply(
            `Укажите возраст ребенка №${
              ctx.wizard.state.currentChildIndex + 1
            }:`,
            Markup.removeKeyboard()
          );
          return;
        }

        await ctx.reply('✅ Возраста детей сохранены');
        delete ctx.wizard.state.currentChildIndex;

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

      // Начальный ввод количества детей
      let children = 0;

      if (input.startsWith('children_')) {
        children = parseInt(input.replace('children_', ''));
      } else if (input === 'Нет детей') {
        children = 0;
      } else {
        children = parseInt(input);
      }

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

      if (children > 0) {
        ctx.wizard.state.childrenAges = [];
        ctx.wizard.state.currentChildIndex = 0;

        await ctx.reply(`Укажите возраст ребенка №1:`, Markup.removeKeyboard());
        return; // остаёмся в этом шаге
      }

      // Если детей нет → сразу к отелю
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

      if (!validOptions.includes(ctx.callbackQuery.data)) {
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
    // Шаг 11: Рейтинг отеля + отправка заявки
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

      // Сбор данных и отправка менеджеру
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
  `;

      try {
        await ctx.telegram.sendMessage(process.env.ADMIN_CHAT_ID, application, {
          parse_mode: 'Markdown',
        });
      } catch (error) {
        console.error('Ошибка отправки:', error);
        await ctx.reply('❌ Ошибка отправки данных. Попробуйте позже.');
        return { success: false };
      }

      // Финальное сообщение пользователю
      await ctx.reply(
        `✅ Спасибо! Ваши данные отправлены менеджеру.\nХотите заполнить новую заявку?`,
        Markup.inlineKeyboard([
          Markup.button.callback('🔄 Начать заново', 'restart_survey'),
        ])
      );

      return ctx.wizard.selectStep(0); // перезапуск опроса
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
