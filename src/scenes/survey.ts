// Импортируем необходимые модули для работы с Telegram ботом
import { Markup, Scenes } from 'telegraf'; // Для создания inline-кнопок и работы со сценами
import type { Context } from 'telegraf'; // Тип контекста бота
import { survey } from '../questions/questions.js'; // Наш список вопросов
import { Question } from '../questions/types.js'; // Типы вопросов
import {
  calendarKeyboard,
  nextMonth,
  prevMonth,
  ageKeyboard,
} from '../keyboards/index.js'; // Функции для календаря и других клавиатур

// Локальные карты городов и стран
import departureCities from '../constants/mapDeparture.js';
import destinationCountries from '../constants/mapCountry.js';
import { USERNAME_TELEGRAM, TELEGRAM_ADMIN_ID } from '../config.js';

// Определяем структуру состояния сцены (что храним для каждого пользователя)
interface SurveySceneState {
  index: number; // Номер текущего вопроса (0, 1, 2...)
  answers: Record<string, string>; // Словарь ответов: {"date": "2024-01-15", "hotel": "5"}
  childAgeExpected?: number;
  childAgeIndex?: number;
  childAges?: number[];
}

// Расширяем базовый контекст бота (здесь используем any для простоты типизации)
type SurveyContext = Context & any;

// Функция для безопасного редактирования разметки сообщения
async function safeEditMessageReplyMarkup(ctx: any, markup: any) {
  try {
    await ctx.editMessageReplyMarkup(markup);
  } catch (error: any) {
    // Игнорируем ошибку "message is not modified"
    if (
      error.response &&
      error.response.error_code === 400 &&
      error.response.description.includes('message is not modified')
    ) {
      console.log('Safe edit: message not modified (same markup)');
    } else {
      throw error;
    }
  }
}

// Функция для безопасного удаления разметки сообщения
async function safeRemoveReplyMarkup(ctx: any) {
  try {
    await safeEditMessageReplyMarkup(ctx, undefined);
  } catch (error: any) {
    // Игнорируем ошибки при удалении разметки
    console.log('Error removing reply markup:', error.message);
  }
}

function getOptionLabel(questionId: string, value: string): string {
  const q = survey.questions.find((x) => (x as any).id === questionId);
  if (!q) return value;
  if ((q as any).type === 'multipleChoice') {
    const opt = (q as any).options?.find(
      (o: any) => String(o.value) === String(value)
    );
    return opt?.label ?? value;
  }
  return value;
}

// ========= МЕХАНИЗМ КОНТРОЛЯ БЕЗДЕЙСТВИЯ И «ЗАЦИКЛИВАНИЯ» =========
function clearIdleGuard(ctx: any) {
  const state = (ctx.scene.state ||= { index: 0, answers: {} });
  if (state.__idleTimer) {
    clearTimeout(state.__idleTimer);
    state.__idleTimer = undefined;
  }
}

function scheduleIdleGuard(ctx: any) {
  const state = (ctx.scene.state ||= { index: 0, answers: {} });
  clearIdleGuard(ctx);
  state.__idleTimer = setTimeout(async () => {
    try {
      const contact = USERNAME_TELEGRAM || '@TvoiTouragent';
      const contactHandle = contact.startsWith('@')
        ? contact.slice(1)
        : contact;
      const contactBtn = contactHandle
        ? Markup.button.url(
            `💬 Связаться: @${contactHandle}`,
            `https://t.me/${contactHandle}`
          )
        : Markup.button.callback('💬 Связаться с менеджером', 'assist:contact');
      await ctx.reply('Похоже, у нас пауза. Что сделать?', {
        ...Markup.inlineKeyboard([
          [contactBtn],
          [Markup.button.callback('🔁 Начать заново', 'assist:restart')],
          [Markup.button.callback('▶️ Продолжить', 'assist:continue')],
        ]),
      });
      state.__lastAssistAt = Date.now();
    } catch {}
  }, 30000);
}

function showAssist(ctx: any) {
  const contact = USERNAME_TELEGRAM || '@TvoiTouragent';
  const contactHandle = contact.startsWith('@') ? contact.slice(1) : contact;
  const contactBtn = contactHandle
    ? Markup.button.url(
        `💬 Связаться: @${contactHandle}`,
        `https://t.me/${contactHandle}`
      )
    : Markup.button.callback('💬 Связаться с менеджером', 'assist:contact');
  return ctx.reply('Нужна помощь?', {
    ...Markup.inlineKeyboard([
      [contactBtn],
      [Markup.button.callback('🔁 Начать заново', 'assist:restart')],
      [Markup.button.callback('▶️ Продолжить', 'assist:continue')],
    ]),
  });
}

function resetFailCount(ctx: any, questionId: string) {
  const state = (ctx.scene.state ||= { index: 0, answers: {} });
  state.__failCount = state.__failCount || {};
  state.__failCount[questionId] = 0;
}

function incrementFailCount(ctx: any, questionId: string, threshold = 3) {
  const state = (ctx.scene.state ||= { index: 0, answers: {} });
  state.__failCount = state.__failCount || {};
  state.__failCount[questionId] = (state.__failCount[questionId] || 0) + 1;
  if (state.__failCount[questionId] >= threshold) {
    return showAssist(ctx);
  }
  return Promise.resolve();
}

// Функция для отправки вопроса пользователю
async function askQuestion(ctx: SurveyContext, question: Question) {
  // Счетчик повторных заданий одного и того же вопроса
  const state = (ctx.scene.state ||= { index: 0, answers: {} });
  state.__askedCount = state.__askedCount || {};
  const qid = (question as any).id as string;
  state.__askedCount[qid] = (state.__askedCount[qid] || 0) + 1;
  if (state.__askedCount[qid] >= 3) {
    try {
      await ctx.reply('Кажется, возникли сложности. Чем помочь?', {
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '💬 Связаться с менеджером',
              'assist:contact'
            ),
          ],
          [Markup.button.callback('🔁 Начать заново', 'assist:restart')],
          [Markup.button.callback('▶️ Продолжить', 'assist:continue')],
        ]),
      });
    } catch {}
  }
  // Спец-обработка: большие справочники городов/стран
  if (question.id === 'departureCity') {
    // Топ популярных городов (можно поправить список)
    const top = [
      'Москва',
      'Санкт-Петербург',
      'Красноярск',
      'Екатеринбург',
      'Новосибирск',
      'Казань',
    ];
    const rows = top
      .filter((name) => departureCities[name] !== undefined)
      .map((name) => [
        Markup.button.callback(
          name,
          `q:departureCity:opt:${String(departureCities[name])}`
        ),
      ]);
    rows.push([Markup.button.callback('Показать все', 'q:departureCity:all')]);
    await ctx.reply(question.text, Markup.inlineKeyboard(rows));
    scheduleIdleGuard(ctx);
    return;
  }

  if (question.id === 'destinationCountry') {
    const top = ['Турция', 'Египет', 'ОАЭ', 'Таиланд', 'Россия'];
    const rows = top
      .filter((name) => destinationCountries[name] !== undefined)
      .map((name) => [
        Markup.button.callback(
          name,
          `q:destinationCountry:opt:${String(destinationCountries[name])}`
        ),
      ]);
    rows.push([
      Markup.button.callback('Показать все', 'q:destinationCountry:all'),
    ]);
    await ctx.reply(question.text, Markup.inlineKeyboard(rows));
    scheduleIdleGuard(ctx);
    return;
  }

  // Если вопрос с вариантами выбора (multipleChoice)
  if (question.type === 'multipleChoice') {
    // Создаем кнопки для каждого варианта
    const rows = question.options.map((opt) => [
      // Формат callback: "q:<questionId>:opt:<value>"
      // Это позволит нам понять, на какой вопрос и какой вариант ответил пользователь
      Markup.button.callback(opt.label, `q:${question.id}:opt:${opt.value}`),
    ]);
    // Отправляем сообщение с текстом вопроса и кнопками
    await ctx.reply(question.text, Markup.inlineKeyboard(rows));
    return;
  }

  // Если вопрос про дату (date)
  if (question.type === 'date') {
    // Получаем текущую дату для показа календаря
    const now = new Date();
    // Отправляем сообщение с календарем
    await ctx.reply(
      question.text,
      calendarKeyboard(
        now.getFullYear(),
        now.getMonth(),
        `date:${question.id}`,
        { min: new Date() }
      )
    );
    scheduleIdleGuard(ctx);
    return;
  }
}

// Функция для перехода к следующему вопросу или завершения опроса
async function proceed(ctx: SurveyContext) {
  // Получаем состояние сцены (индекс текущего вопроса и ответы)
  const state = ctx.scene.state || ({} as SurveySceneState);

  // Берем текущий вопрос по индексу
  const q = survey.questions[state.index];

  // Если вопросов больше нет - завершаем диалог
  if (!q) {
    const a = state.answers || {};
    const cityName = a['departureCityName'] || '-';
    const cityId = a['departureCityId'] || '-';
    const countryName = a['destinationCountryName'] || '-';
    const countryId = a['destinationCountryId'] || '-';
    const date = a['departureDate'] || '-';
    const nights = a['nights'] || '-';
    const adults = a['adults'] || '0';
    const children = a['children'] || '0';
    const hotelClass = getOptionLabel('hotelClass', a['hotelClass'] || '-');
    const hotelType = getOptionLabel('hotelType', a['hotelType'] || '-');
    const meal = getOptionLabel('meal', a['meal'] || '-');
    const rating = getOptionLabel('rating', a['rating'] || '-');

    const agesSummary = a['childrenAges']
      ? ` (возраст: ${a['childrenAges']})`
      : '';
    const application =
      `🌟 *НОВАЯ ЗАЯВКА НА ТУР* 🌟\n\n` +
      `📍 *Город вылета:* ${cityName} (ID: ${cityId})\n` +
      `🌍 *Страна отдыха:* ${countryName} (ID: ${countryId})\n` +
      `📅 *Дата вылета:* ${date}\n` +
      `🌙 *Ночей:* ${nights}\n` +
      `👨‍👩‍👧 *Путешественники:* ${adults} взрослых, ${children} детей${agesSummary}\n` +
      `🏨 *Отель:* ${hotelClass}, ${hotelType}\n` +
      `🍽️ *Питание:* ${meal}\n` +
      `⭐ *Рейтинг:* ${rating}`;

    await ctx.reply(application, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔁 Начать заново', 'start:begin')],
      ]),
    });

    // ИСПРАВЛЕННЫЙ КОД ОТПРАВКИ АДМИНИСТРАТОРУ
    try {
      const adminId = TELEGRAM_ADMIN_ID;

      // Добавим подробное логирование
      console.log('Attempting to send to admin:', {
        adminId,
        hasAdminId: !!adminId,
      });

      if (adminId) {
        const from = ctx.from;
        let userRef = '';

        // Безопасное получение информации о пользователе
        if (from) {
          if (from.username) {
            // Экранируем username для Markdown
            const safeUsername = from.username
              .replace(/\*/g, '\\*')
              .replace(/_/g, '\\_');
            userRef = `\n👤 Пользователь: @${safeUsername}`;
          } else if (from.id) {
            try {
              const chat = await ctx.telegram.getChat(from.id);
              if (chat && (chat as any)?.username) {
                const safeUsername = (chat as any).username
                  .replace(/\*/g, '\\*')
                  .replace(/_/g, '\\_');
                userRef = `\n👤 Пользователь: @${safeUsername}`;
              } else {
                // Если нет username, используем ссылку на профиль через ID
                const firstName = from.first_name || '';
                const lastName = from.last_name || '';
                const fullName =
                  [firstName, lastName].filter(Boolean).join(' ') ||
                  'Пользователь';
                userRef = `\n👤 Пользователь: [${fullName}](tg://user?id=${from.id}) (ID: ${from.id})`;
              }
            } catch (error) {
              console.log('Error getting chat info:', error);
              // Fallback: ссылка через ID, если не удалось получить информацию
              const firstName = from.first_name || '';
              const lastName = from.last_name || '';
              const fullName =
                [firstName, lastName].filter(Boolean).join(' ') ||
                'Пользователь';
              userRef = `\n👤 Пользователь: [${fullName}](tg://user?id=${from.id}) (ID: ${from.id})`;
            }
          }
        } else {
          userRef = `\n👤 Пользователь: аноним`;
        }

        // Экранируем только критичные спецсимволы Markdown (* и _) в данных
        // чтобы не сломать форматирование заголовков
        const escapeMarkdown = (text: string) => {
          return text.replace(/\*/g, '\\*').replace(/_/g, '\\_');
        };

        // Создаём версию для админа с экранированными спецсимволами (кроме форматирования заголовков)
        // Сохраняем структуру форматирования, но экранируем символы в данных
        const adminMessage =
          `🌟 *НОВАЯ ЗАЯВКА НА ТУР* 🌟\n\n` +
          `📍 *Город вылета:* ${escapeMarkdown(cityName)} (ID: ${cityId})\n` +
          `🌍 *Страна отдыха:* ${escapeMarkdown(
            countryName
          )} (ID: ${countryId})\n` +
          `📅 *Дата вылета:* ${escapeMarkdown(date)}\n` +
          `🌙 *Ночей:* ${escapeMarkdown(nights)}\n` +
          `👨‍👩‍👧 *Путешественники:* ${escapeMarkdown(
            adults
          )} взрослых, ${escapeMarkdown(children)} детей${escapeMarkdown(
            agesSummary
          )}\n` +
          `🏨 *Отель:* ${escapeMarkdown(hotelClass)}, ${escapeMarkdown(
            hotelType
          )}\n` +
          `🍽️ *Питание:* ${escapeMarkdown(meal)}\n` +
          `⭐ *Рейтинг:* ${escapeMarkdown(rating)}` +
          userRef;

        console.log('Sending message to admin:', adminMessage);

        // Преобразуем adminId в число и отправляем
        await ctx.telegram.sendMessage(Number(adminId), adminMessage, {
          parse_mode: 'Markdown',
        });

        console.log('Message sent successfully to admin');
      } else {
        console.log('No admin ID configured');
      }
    } catch (error) {
      // Логируем ошибку вместо игнорирования
      console.error('Error sending message to admin:', error);

      // Можно также отправить сообщение об ошибке в лог бота
      try {
        await ctx.reply(
          '⚠️ Произошла ошибка при отправке заявки. Но ваша заявка сохранена!'
        );
      } catch (e) {
        // Игнорируем ошибки в уведомлении пользователя
      }
    }

    await ctx.scene.leave();
    return;
  }

  // Есть еще вопросы - отправляем следующий
  await askQuestion(ctx, q);
}

// Создаем и экспортируем функцию, которая возвращает готовую сцену для опроса
export function createSurveyScene() {
  // Создаем WizardScene - это особая сцена для многошаговых диалогов
  const scene = new Scenes.WizardScene<SurveyContext>(
    'survey', // Идентификатор сцены (используется для входа в нее)
    async (ctx: any) => {
      // Инициализация сцены (вызывается один раз при входе)
      // Если состояние еще не инициализировано, создаем его
      if (!ctx.scene.state || typeof ctx.scene.state.index !== 'number') {
        ctx.scene.state = { index: 0, answers: {} };
      }
      // Переходим к первому вопросу
      await proceed(ctx);
    }
  );

  // ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================

  // Кнопка "Показать все" для городов вылета
  scene.action('q:departureCity:all', async (ctx: any) => {
    clearIdleGuard(ctx);
    await ctx.answerCbQuery();
    const names = Object.keys(departureCities).sort((a, b) =>
      a.localeCompare(b, 'ru')
    );
    const buttons = names.map((name) =>
      Markup.button.callback(
        name,
        `q:departureCity:opt:${String(departureCities[name])}`
      )
    );
    // Разобьем по 2 в ряд для компактности
    const rows: any[] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push([buttons[i], buttons[i + 1]].filter(Boolean));
    }
    try {
      await safeEditMessageReplyMarkup(
        ctx,
        Markup.inlineKeyboard(rows).reply_markup
      );
    } catch {
      await ctx.reply('Выберите город вылета:', Markup.inlineKeyboard(rows));
    }
  });

  // Кнопка "Показать все" для стран отдыха
  scene.action('q:destinationCountry:all', async (ctx: any) => {
    clearIdleGuard(ctx);
    await ctx.answerCbQuery();
    const names = Object.keys(destinationCountries).sort((a, b) =>
      a.localeCompare(b, 'ru')
    );
    const buttons = names.map((name) =>
      Markup.button.callback(
        name,
        `q:destinationCountry:opt:${String(destinationCountries[name])}`
      )
    );
    const rows: any[] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push([buttons[i], buttons[i + 1]].filter(Boolean));
    }
    try {
      await safeEditMessageReplyMarkup(
        ctx,
        Markup.inlineKeyboard(rows).reply_markup
      );
    } catch {
      await ctx.reply('Выберите страну отдыха:', Markup.inlineKeyboard(rows));
    }
  });

  // Обработчик для кнопок выбора варианта ответа
  // Формат callback: "q:<questionId>:opt:<value>"
  // Пример: "q:hotel:opt:5" - пользователь выбрал вариант "5" для вопроса "hotel"
  scene.action(/q:([^:]+):opt:(.+)/, async (ctx: any) => {
    // Извлекаем questionId и value из callback_data с помощью регулярного выражения
    // ctx.match содержит массив: [полная_строка, первая_группа, вторая_группа, ...]
    const [, questionId, value] = ctx.match as RegExpMatchArray;

    // Инициализируем состояние, если его еще нет
    const state = (ctx.scene.state ||= { index: 0, answers: {} });
    clearIdleGuard(ctx);

    // Сохраняем ответ пользователя
    if (questionId === 'departureCity') {
      const idNum = Number(value);
      const name =
        Object.entries(departureCities).find(
          ([, id]) => Number(id) === idNum
        )?.[0] || String(value);
      state.answers['departureCityId'] = String(idNum);
      state.answers['departureCityName'] = name;
      resetFailCount(ctx, 'departureCity');
    } else if (questionId === 'destinationCountry') {
      const idNum = Number(value);
      const name =
        Object.entries(destinationCountries).find(
          ([, id]) => Number(id) === idNum
        )?.[0] || String(value);
      state.answers['destinationCountryId'] = String(idNum);
      state.answers['destinationCountryName'] = name;
      resetFailCount(ctx, 'destinationCountry');
    } else if (questionId === 'children') {
      state.answers[questionId] = value;
      const count = Number(value);
      if (count > 0) {
        state.childAgeExpected = count;
        state.childAgeIndex = 1;
        state.childAges = [];
        // Ответ на нажатие
        await ctx.answerCbQuery();
        // Убрать кнопки
        await safeRemoveReplyMarkup(ctx);
        // Спросить возраст ребёнка 1
        await ctx.reply(
          `👶 Укажите возраст ребёнка ${state.childAgeIndex} (лет):`,
          ageKeyboard()
        );
        return; // Не двигаем индекс, пока не соберём все возрасты
      }
      resetFailCount(ctx, 'children');
    } else {
      state.answers[questionId] = value;
      resetFailCount(ctx, questionId);
    }

    // Переходим к следующему вопросу
    state.index += 1;

    // Отвечаем на нажатие кнопки (убираем "загрузку" с кнопки)
    await ctx.answerCbQuery();

    // Пытаемся убрать кнопки из сообщения (можно оставить как есть)
    await safeRemoveReplyMarkup(ctx);

    // Задаем следующий вопрос
    await proceed(ctx as SurveyContext);
  });

  // Обработка выбора возраста ребёнка: age_<n>
  scene.action(/age_(\d{1,2})/, async (ctx: any) => {
    const [, ageStr] = ctx.match as RegExpMatchArray;
    const age = Number(ageStr);
    const state = (ctx.scene.state ||= { index: 0, answers: {} });

    if (!Number.isFinite(age)) {
      await ctx.answerCbQuery('Некорректный возраст');
      return;
    }

    state.childAges ||= [];
    state.childAges.push(age);
    state.childAgeIndex = (state.childAgeIndex || 1) + 1;

    await ctx.answerCbQuery(`Возраст: ${age}`);
    await safeRemoveReplyMarkup(ctx);

    if ((state.childAgeExpected || 0) >= (state.childAgeIndex || 0)) {
      await ctx.reply(
        `👶 Укажите возраст ребёнка ${state.childAgeIndex} (лет):`,
        ageKeyboard()
      );
      return;
    }

    // Все возрасты собраны
    state.answers['childrenAges'] = (state.childAges || []).join(', ');
    delete state.childAgeExpected;
    delete state.childAgeIndex;
    delete state.childAges;

    // Теперь двигаемся к следующему вопросу (после children)
    state.index += 1;
    await proceed(ctx as SurveyContext);
  });

  // Обработчик для навигации по месяцам в календаре
  // Формат callback: "date:<questionId>:nav:<year>:<month>:(prev|next)"
  // Пример: "date:date:nav:2024:11:next" - перелистывание на следующий месяц
  scene.action(
    /date:([^:]+):nav:(\d{4}):(\d{1,2}):(prev|next)/,
    async (ctx: any) => {
      clearIdleGuard(ctx);

      try {
        // Извлекаем параметры из callback_data
        const [, questionId, y, m, dir] = ctx.match as RegExpMatchArray;

        // Создаем объект с текущим годом и месяцем
        const payload = { year: Number(y), month: Number(m) };

        // Определяем, какой месяц показать: следующий или предыдущий
        const target = dir === 'next' ? nextMonth(payload) : prevMonth(payload);

        // Отвечаем на нажатие кнопки
        await ctx.answerCbQuery();

        // Запрещаем перелистывание в прошлое (меньше текущего месяца)
        const now = new Date();
        const minYear = now.getFullYear();
        const minMonth = now.getMonth();
        if (
          target.year < minYear ||
          (target.year === minYear && target.month < minMonth)
        ) {
          await ctx.answerCbQuery('Прошедшие месяцы недоступны');
          return;
        }

        // Обновляем календарь на новом месяце, с ограничением на прошлые даты
        await ctx.editMessageReplyMarkup(
          calendarKeyboard(target.year, target.month, `date:${questionId}`, {
            min: now,
          }).reply_markup
        );
      } catch (error: any) {
        // Игнорируем ошибку "message is not modified"
        if (
          error.response &&
          error.response.error_code === 400 &&
          error.response.description.includes('message is not modified')
        ) {
          console.log('Calendar navigation: message not modified');
          // Все равно отвечаем на callback query чтобы убрать "часики"
          try {
            await ctx.answerCbQuery();
          } catch (e) {
            // Игнорируем ошибки при ответе на callback
          }
        } else {
          // Пробрасываем другие ошибки
          throw error;
        }
      }

      scheduleIdleGuard(ctx);
    }
  );

  // Обработчик для выбора конкретной даты в календаре
  // Формат callback: "date:<questionId>:pick:<year>:<month>:<day>"
  // Пример: "date:date:pick:2024:11:15" - пользователь выбрал 15 декабря 2024
  scene.action(
    /date:([^:]+):pick:(\d{4}):(\d{1,2}):(\d{1,2})/,
    async (ctx: any) => {
      clearIdleGuard(ctx);
      // Извлекаем параметры даты из callback_data
      const [, questionId, y, m, d] = ctx.match as RegExpMatchArray;

      // Числовые значения
      const yNum = Number(y);
      const mNum = Number(m);
      const dNum = Number(d);

      // Дата без учёта часового пояса (локальная полночь)
      const picked = new Date(yNum, mNum, dNum);

      // Сохраняем выбранную дату (защитимся от выбора прошедшей даты)
      const state = (ctx.scene.state ||= { index: 0, answers: {} });
      const now = new Date();
      const min = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (picked < min) {
        await ctx.answerCbQuery('Нельзя выбрать прошедшую дату');
        return;
      }

      // Строка YYYY-MM-DD без влияния таймзоны
      const pad = (n: number) => String(n).padStart(2, '0');
      const iso = `${yNum}-${pad(mNum + 1)}-${pad(dNum)}`;
      state.answers[questionId] = iso;

      // Переходим к следующему вопросу
      state.index += 1;

      // Показываем пользователю, что дата выбрана
      await ctx.answerCbQuery(`Выбрано: ${iso}`);

      // Убираем календарь
      await safeRemoveReplyMarkup(ctx);

      // Задаем следующий вопрос
      await proceed(ctx as SurveyContext);
    }
  );

  // Обработчик для "пустых" кнопок (например, заголовки дней недели в календаре)
  // Эти кнопки ничего не делают, просто "закрываются" при нажатии
  scene.action(/.*:noop.*/, async (ctx: any) => ctx.answerCbQuery());

  // Меню помощи: контакт, рестарт, продолжить
  scene.action('assist:contact', async (ctx: any) => {
    clearIdleGuard(ctx);
    const contact = USERNAME_TELEGRAM || '@tour_manager';
    await ctx.answerCbQuery();
    await safeRemoveReplyMarkup(ctx);
    await ctx.reply(`Напишите нашему менеджеру: ${contact}`);
    scheduleIdleGuard(ctx);
  });

  scene.action('assist:restart', async (ctx: any) => {
    clearIdleGuard(ctx);
    await ctx.answerCbQuery();
    await safeRemoveReplyMarkup(ctx);
    ctx.scene.state = { index: 0, answers: {} };
    await proceed(ctx as SurveyContext);
  });

  scene.action('assist:continue', async (ctx: any) => {
    clearIdleGuard(ctx);
    await ctx.answerCbQuery();
    await safeRemoveReplyMarkup(ctx);
    const state = (ctx.scene.state ||= { index: 0, answers: {} });
    const q = survey.questions[state.index];
    if (q) {
      await askQuestion(ctx as SurveyContext, q as Question);
    }
  });

  // Обработка текстовых сообщений во время опроса
  scene.on('text', async (ctx: any) => {
    const text: string = (ctx.message?.text || '').trim();
    const state = (ctx.scene.state ||= { index: 0, answers: {} });
    clearIdleGuard(ctx);

    // Если мы в режиме сбора возрастов детей — ожидаем число 0..15
    if (state.childAgeExpected && state.childAgeIndex) {
      const n = Number(text.replace(/[^0-9]/g, ''));
      if (Number.isFinite(n) && n >= 0 && n <= 15) {
        state.childAges ||= [];
        state.childAges.push(n);
        state.childAgeIndex += 1;
        if (state.childAgeIndex <= state.childAgeExpected) {
          await ctx.reply(
            `👶 Укажите возраст ребёнка ${state.childAgeIndex} (лет):`,
            ageKeyboard()
          );
          return;
        }
        // Все возрасты собраны
        state.answers['childrenAges'] = (state.childAges || []).join(', ');
        delete state.childAgeExpected;
        delete state.childAgeIndex;
        delete state.childAges;
        // Переходим дальше после вопроса children
        state.index += 1;
        await proceed(ctx as SurveyContext);
        return;
      } else {
        await ctx.reply(
          'Введите возраст числом от 0 до 15 или используйте кнопки.'
        );
        return;
      }
    }

    // Определим текущий вопрос
    const q = survey.questions[state.index];
    if (!q) return;

    const lower = text.toLowerCase();

    // Ввод города вылета текстом
    if ((q as any).id === 'departureCity') {
      const entry =
        Object.entries(departureCities).find(
          ([name]) => name.toLowerCase() === lower
        ) ||
        Object.entries(departureCities).find(([name]) =>
          name.toLowerCase().includes(lower)
        );

      if (entry) {
        const [name, id] = entry as [string, number];
        state.answers['departureCityId'] = String(id);
        state.answers['departureCityName'] = name;
        state.index += 1;
        await ctx.reply(`✅ Выбран город: ${name}`);
        await proceed(ctx as SurveyContext);
        return;
      }
      await ctx.reply('Не нашёл такой город. Выберите из списка кнопок.');
      await incrementFailCount(ctx, 'departureCity');
      return;
    }

    // Ввод страны текстом
    if ((q as any).id === 'destinationCountry') {
      const entry =
        Object.entries(destinationCountries).find(
          ([name]) => name.toLowerCase() === lower
        ) ||
        Object.entries(destinationCountries).find(([name]) =>
          name.toLowerCase().includes(lower)
        );

      if (entry) {
        const [name, id] = entry as [string, number];
        state.answers['destinationCountryId'] = String(id);
        state.answers['destinationCountryName'] = name;
        state.index += 1;
        await ctx.reply(`✅ Выбрана страна: ${name}`);
        await proceed(ctx as SurveyContext);
        return;
      }
      await ctx.reply('Не нашёл такую страну. Выберите из списка кнопок.');
      await incrementFailCount(ctx, 'destinationCountry');
      return;
    }

    // Если на вопрос о количестве детей прислали число текстом — примем его
    if ((q as any).id === 'children') {
      const n = Number(text.replace(/[^0-9]/g, ''));
      if (Number.isFinite(n) && n >= 0 && n <= 3) {
        state.answers['children'] = String(n);
        if (n > 0) {
          state.childAgeExpected = n;
          state.childAgeIndex = 1;
          state.childAges = [];
          await ctx.reply(
            `👶 Укажите возраст ребёнка ${state.childAgeIndex} (лет):`,
            ageKeyboard()
          );
          return;
        }
        state.index += 1;
        await proceed(ctx as SurveyContext);
        return;
      }
      await ctx.reply('Введите число от 0 до 3 или используйте кнопки.');
      await incrementFailCount(ctx, 'children');
      return;
    }

    // Для остальных шагов просим пользоваться кнопками
    await ctx.reply('Пожалуйста, используйте кнопки ниже для выбора.');
    const qid = (q as any).id as string;
    await incrementFailCount(ctx, qid);
  });

  // Обработчик входа в сцену (вызывается автоматически при ctx.scene.enter('survey'))
  scene.enter(async (ctx: any) => {
    // Инициализируем состояние для нового опроса
    ctx.scene.state = { index: 0, answers: {} };

    // Начинаем с первого вопроса
    await proceed(ctx as SurveyContext);
  });

  // Возвращаем готовую сцену
  return scene;
}
