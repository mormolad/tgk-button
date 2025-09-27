const { Scenes, Markup } = require('telegraf');
const departureCities = require('../const/mapDeparture');
const destinationCountries = require('../const/mapCountry');
const processHotelData = require('../utils/sortHotel');
const { logStep } = require('../utils/logger');
const { withStuckWatcher } = require('../middlewares/stuckWatcher');
const generateCalendar = require('../utils/generateCalendar');

// helper: клавиатура для возрастов 0..15 (4 столбца)
const ageKeyboard = () =>
  Markup.inlineKeyboard(
    Array.from({ length: 16 }, (_, i) =>
      Markup.button.callback(i.toString(), `age_${i}`)
    ),
    { columns: 4 }
  );

const tourQuestionnaire = new Scenes.WizardScene(
  'TOUR_QUESTIONNAIRE',
  ...withStuckWatcher([
    // Шаг 0: Приветствие
    async (ctx) => {
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
            Markup.button.callback('👤', 'adults_1'),
            Markup.button.callback('👤👤', 'adults_2'),
            Markup.button.callback('👤👤👤', 'adults_3'),
            Markup.button.callback('👤👤👤👤', 'adults_4'),
            Markup.button.callback('👤👤👤👤👤', 'adults_5'),
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
            Markup.button.callback('👶', '1'),
            Markup.button.callback('👶👶', '2'),
            Markup.button.callback('👶👶👶', '3'),
            Markup.button.callback('👶👶👶👶', '4'),
            Markup.button.callback('❌ Нет детей', '0'),
          ];

          await ctx.reply(
            '6/11: Сколько будет детей?',
            Markup.inlineKeyboard(childButtons, { columns: 3 })
          );
          return ctx.wizard.next();
        }
      }
    },

    // Шаг 7: спрашиваем количество детей (1 сообщение — inline)
    async (ctx) => {
      // если пришёл callback с выбором — сохраняем и переходим
      if (ctx.updateType === 'callback_query') {
        const data = ctx.callbackQuery.data;
        await ctx.answerCbQuery();

        if (data) {
          const children = parseInt(data.replace('children_', ''), 10) || 0;
          ctx.wizard.state.children = children;
          // редактируем исходное сообщение с кнопками в статус
          try {
            await ctx.editMessageText(`✅ Количество детей: ${children}`);
          } catch (e) {
            // если не получилось редактировать — просто отправим сообщение
            await ctx.reply(`✅ Количество детей: ${children}`);
          }
          return ctx.wizard.next();
        }
      }

      // fallback: если пользователь ввёл текст с числом
      if (ctx.message && ctx.message.text) {
        const txt = ctx.message.text.trim();
        if (txt === 'Нет детей' || txt === '❌ Нет детей') {
          ctx.wizard.state.children = 0;
          await ctx.reply('✅ Количество детей: 0');
          return ctx.wizard.next();
        }
        const n = parseInt(txt, 10);
        if (!isNaN(n) && n >= 0 && n <= 10) {
          ctx.wizard.state.children = n;
          await ctx.reply(`✅ Количество детей: ${n}`);
          return ctx.wizard.next();
        }
      }

      // показываем inline-кнопки (на вход — ожидаем callback)
      const buttons = [
        Markup.button.callback('❌ Нет детей', 'children_0'),
        Markup.button.callback('👶', 'children_1'),
        Markup.button.callback('👶👶', 'children_2'),
        Markup.button.callback('👶👶👶', 'children_3'),
        Markup.button.callback('👶👶👶👶', 'children_4'),
      ];
      await ctx.reply(
        '7/11: Сколько будет детей?',
        Markup.inlineKeyboard(buttons, { columns: 3 })
      );
    },

    // Шаг 8: проверяем значение и (если нужно) собираем возраста по очереди через inline 0..15 (4 столбца)
    async (ctx) => {
      const children = Number(ctx.wizard.state.children) || 0;

      // если ещё не начали сбор возрастов — и детей нет → пропускаем к отелю
      if (!ctx.wizard.state.collectingChildrenAges) {
        if (children === 0) {
          // нет детей — сразу показываем клавиатуру для выбора класса отеля и далее next()
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

        // есть дети — инициализируем сбор возрастов и спрашиваем возраст 1-го
        ctx.wizard.state.childrenAges = [];
        ctx.wizard.state.currentChildIndex = 0;
        ctx.wizard.state.collectingChildrenAges = true;

        await ctx.reply(`Укажите возраст ребёнка №1:`, ageKeyboard());
        return; // остаёмся в этом шаге до тех пор, пока все возраста не соберём
      }

      // --- далее: мы в процессе сбора возрастов ---
      // получаем input (callback или текст)
      let input;
      if (ctx.updateType === 'callback_query') {
        input = ctx.callbackQuery.data;
        await ctx.answerCbQuery();
      } else if (ctx.message && ctx.message.text) {
        input = ctx.message.text.trim();
      } else {
        return; // ничего не делаем если пришло что-то ещё
      }

      // парсим возраст (поддержка 'age_X' и текстового ввода)
      let age = null;
      if (typeof input === 'string' && input.startsWith('age_')) {
        age = parseInt(input.replace('age_', ''), 10);
      } else {
        age = parseInt(input, 10);
      }

      if (isNaN(age) || age < 0 || age > 15) {
        // неверный ввод — просим выбрать снова
        await ctx.reply(
          '❌ Возраст должен быть от 0 до 15. Выберите с кнопок:'
        );
        await ctx.reply(
          `Укажите возраст ребёнка №${ctx.wizard.state.currentChildIndex + 1}:`,
          ageKeyboard()
        );
        return;
      }

      // сохраняем возраст
      const idx = ctx.wizard.state.currentChildIndex;
      ctx.wizard.state.childrenAges.push(age);

      // если callback — редактируем сообщение с кнопками, чтобы показать подтверждение выбора
      if (ctx.updateType === 'callback_query') {
        try {
          await ctx.editMessageText(`✅ Возраст ребёнка №${idx + 1}: ${age}`);
        } catch (e) {
          // игнорируем ошибку редактирования (сообщение могло быть старым)
        }
      } else {
        await ctx.reply(`✅ Возраст ребёнка №${idx + 1}: ${age}`);
      }

      ctx.wizard.state.currentChildIndex++;

      // если остались дети → спрашиваем следующего
      if (ctx.wizard.state.currentChildIndex < children) {
        await ctx.reply(
          `Укажите возраст ребёнка №${ctx.wizard.state.currentChildIndex + 1}:`,
          ageKeyboard()
        );
        return;
      }

      // все возраста собраны
      delete ctx.wizard.state.currentChildIndex;
      delete ctx.wizard.state.collectingChildrenAges;

      await ctx.reply('✅ Возраста детей сохранены');

      // и дальше — класс отеля (переходим к следующему шагу)
      await ctx.reply(
        '7/11: Выберите класс отеля:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('3 ★', 'hotel_3'),
            Markup.button.callback('4 ★', 'hotel_4'),
          ],
          [
            Markup.button.callback('5 ★', 'hotel_5'),
            Markup.button.callback('Любой', 'hotel_any'),
          ],
        ])
      );
      return ctx.wizard.next();
    },

    // Шаг 9: Класс отеля
    async (ctx) => {
      if (ctx.updateType !== 'callback_query') {
        return; // ждем только inline-кнопки
      }

      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery();

      // допустимые callback-значения
      const validOptions = {
        hotel_3: '3 ★',
        hotel_4: '4 ★',
        hotel_5: '5 ★',
        hotel_any: 'Любой',
      };

      if (!validOptions[data]) {
        await ctx.reply(
          '❌ Выберите вариант из кнопок:',
          Markup.inlineKeyboard([
            [
              Markup.button.callback('3 ★', 'hotel_3'),
              Markup.button.callback('4 ★', 'hotel_4'),
            ],
            [
              Markup.button.callback('5 ★', 'hotel_5'),
              Markup.button.callback('Любой', 'hotel_any'),
            ],
          ])
        );
        return { success: false };
      }

      // сохраняем выбор
      ctx.wizard.state.hotelClass = validOptions[data];

      // Следующий шаг — выбор типа размещения (тоже inline)
      await ctx.editMessageText(`✅ Класс отеля: ${validOptions[data]}`);

      await ctx.reply(
        '8/11: Выберите тип размещения:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('Отель', 'place_hotel'),
            Markup.button.callback('Пансионат', 'place_pansion'),
            Markup.button.callback('Гостевой дом', 'place_guest'),
          ],
          [
            Markup.button.callback('Апартаменты', 'place_apart'),
            Markup.button.callback('Вилла', 'place_villa'),
            Markup.button.callback('Хостел', 'place_hostel'),
          ],
          [Markup.button.callback('Любой', 'place_any')],
        ])
      );

      return ctx.wizard.next();
    },

    // Шаг 10: Тип отеля
    async (ctx) => {
      if (ctx.updateType !== 'callback_query') {
        return; // ждём только inline-кнопки
      }

      const validOptions = {
        place_hotel: 'Отель',
        place_pansion: 'Пансионат',
        place_guest: 'Гостевой дом',
        place_apart: 'Апартаменты',
        place_villa: 'Вилла',
        place_hostel: 'Хостел',
        place_any: 'Любой',
      };

      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery();

      if (!validOptions[data]) {
        await ctx.reply(
          '❌ Выберите вариант из кнопок:',
          Markup.inlineKeyboard([
            [
              Markup.button.callback('Отель', 'place_hotel'),
              Markup.button.callback('Пансионат', 'place_pansion'),
              Markup.button.callback('Гостевой дом', 'place_guest'),
            ],
            [
              Markup.button.callback('Апартаменты', 'place_apart'),
              Markup.button.callback('Вилла', 'place_villa'),
              Markup.button.callback('Хостел', 'place_hostel'),
            ],
            [Markup.button.callback('Любой', 'place_any')],
          ])
        );
        return { success: false };
      }

      ctx.wizard.state.hotelType = validOptions[data];

      // Кнопки для питания
      await ctx.editMessageText(`✅ Тип размещения: ${validOptions[data]}`);
      await ctx.reply(
        '9/11: Выберите тип питания:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('Только завтрак', 'meal_bb'),
            Markup.button.callback('Завтрак и ужин', 'meal_hb'),
          ],
          [
            Markup.button.callback('Полный пансион', 'meal_fb'),
            Markup.button.callback('Всё включено', 'meal_ai'),
          ],
          [Markup.button.callback('Ультра всё включено', 'meal_uai')],
        ])
      );
      return ctx.wizard.next();
    },

    // Шаг 11: Тип питания
    async (ctx) => {
      if (ctx.updateType !== 'callback_query') {
        return;
      }

      const validMeals = {
        meal_bb: 'Только завтрак',
        meal_hb: 'Завтрак и ужин',
        meal_fb: 'Полный пансион',
        meal_ai: 'Всё включено',
        meal_uai: 'Ультра всё включено',
      };

      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery();

      if (!validMeals[data]) {
        await ctx.reply(
          '❌ Выберите вариант из кнопок:',
          Markup.inlineKeyboard([
            [
              Markup.button.callback('Только завтрак', 'meal_bb'),
              Markup.button.callback('Завтрак и ужин', 'meal_hb'),
            ],
            [
              Markup.button.callback('Полный пансион', 'meal_fb'),
              Markup.button.callback('Всё включено', 'meal_ai'),
            ],
            [Markup.button.callback('Ультра всё включено', 'meal_uai')],
          ])
        );
        return { success: false };
      }

      ctx.wizard.state.mealType = validMeals[data];

      // Кнопки для рейтинга
      await ctx.editMessageText(`✅ Тип питания: ${validMeals[data]}`);
      await ctx.reply(
        '10/11: Минимальный рейтинг отеля:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('3.0+', 'rating_3.0'),
            Markup.button.callback('3.5+', 'rating_3.5'),
          ],
          [
            Markup.button.callback('4.0+', 'rating_4.0'),
            Markup.button.callback('4.5+', 'rating_4.5'),
          ],
        ])
      );
      return ctx.wizard.next();
    },

    // Шаг 12: Рейтинг отеля + отправка заявки
    async (ctx) => {
      if (ctx.updateType !== 'callback_query') {
        return;
      }

      const validRatings = {
        'rating_3.0': '3.0+',
        'rating_3.5': '3.5+',
        'rating_4.0': '4.0+',
        'rating_4.5': '4.5+',
      };

      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery();

      if (!validRatings[data]) {
        await ctx.reply(
          '❌ Выберите вариант из кнопок:',
          Markup.inlineKeyboard([
            [
              Markup.button.callback('3.0+', 'rating_3.0'),
              Markup.button.callback('3.5+', 'rating_3.5'),
            ],
            [
              Markup.button.callback('4.0+', 'rating_4.0'),
              Markup.button.callback('4.5+', 'rating_4.5'),
            ],
          ])
        );
        return { success: false };
      }

      ctx.wizard.state.hotelRating = validRatings[data];

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
      await ctx.editMessageText(
        `✅ Минимальный рейтинг отеля: ${validRatings[data]}`
      );
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
    return ctx.scene.reenter();
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

// каждый раз при входе в сцену сбрасываем состояние
tourQuestionnaire.enter((ctx) => {
  ctx.wizard.state = {};
  if (ctx.session && ctx.session.__scenes) {
    ctx.session.__scenes.state = {};
  }
  // Перезапускаем с шага 0
  ctx.wizard.cursor = 0;
  return ctx.wizard.steps[0](ctx);
});

module.exports = { tourQuestionnaire };
