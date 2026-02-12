// Функции для создания различных типов клавиатур опроса

import { Markup } from 'telegraf';

// ==================== КАЛЕНДАРЬ ====================

export interface CalendarPayload {
  year: number;
  month: number; // 0-11
}

function getMonthMatrix(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekday = (firstDay.getDay() + 6) % 7; // make Monday=0
  const daysInMonth = lastDay.getDate();

  const weeks: (number | null)[][] = [];
  let currentDay = 1;

  // up to 6 weeks
  for (let w = 0; w < 6; w++) {
    const week: (number | null)[] = [];
    for (let d = 0; d < 7; d++) {
      if (w === 0 && d < firstWeekday) {
        week.push(null);
      } else if (currentDay > daysInMonth) {
        week.push(null);
      } else {
        week.push(currentDay);
        currentDay++;
      }
    }
    weeks.push(week);
    if (currentDay > daysInMonth) break;
  }
  return weeks;
}

export function formatMonthTitle(year: number, month: number): string {
  const fmt = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
  return fmt.format(new Date(year, month, 1));
}

export function calendarKeyboard(
  year: number,
  month: number, // 0-11
  prefix = 'date',
  options?: { min?: Date }
) {
  const weeks = getMonthMatrix(year, month);

  // Минимальная дата (по умолчанию сегодня, без времени)
  const minRaw = options?.min ?? new Date();
  const min = new Date(
    minRaw.getFullYear(),
    minRaw.getMonth(),
    minRaw.getDate()
  );

  const atMinMonth =
    year < min.getFullYear() ||
    (year === min.getFullYear() && month <= min.getMonth());

  const header = [
    atMinMonth
      ? Markup.button.callback(' ', `${prefix}:noop`)
      : Markup.button.callback('‹', `${prefix}:nav:${year}:${month}:prev`),
    Markup.button.callback(formatMonthTitle(year, month), `${prefix}:noop`),
    Markup.button.callback('›', `${prefix}:nav:${year}:${month}:next`),
  ];

  const daysHeader = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) =>
    Markup.button.callback(d, `${prefix}:noop`)
  );

  const rows = weeks.map((week) =>
    week.map((day) => {
      if (day === null) return Markup.button.callback(' ', `${prefix}:noop`);
      const btnDate = new Date(year, month, day);
      const isPast = btnDate < min;
      return isPast
        ? Markup.button.callback('·', `${prefix}:noop`)
        : Markup.button.callback(
            String(day),
            `${prefix}:pick:${year}:${month}:${day}`
          );
    })
  );

  return Markup.inlineKeyboard([header, daysHeader, ...rows]);
}

export function nextMonth({ year, month }: CalendarPayload): CalendarPayload {
  const d = new Date(year, month + 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function prevMonth({ year, month }: CalendarPayload): CalendarPayload {
  const d = new Date(year, month - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// ==================== ДРУГИЕ КЛАВИАТУРЫ ====================

// Клавиатура для выбора количества ночей
export function nightsKeyboard() {
  const buttons = [
    [Markup.button.callback('7 ночей', 'nights_7')],
    [Markup.button.callback('10 ночей', 'nights_10')],
    [Markup.button.callback('14 ночей', 'nights_14')],
  ];
  return Markup.inlineKeyboard(buttons);
}

// Клавиатура для выбора количества взрослых
export function adultsKeyboard() {
  const buttons = [];
  for (let i = 1; i <= 4; i++) {
    buttons.push([
      Markup.button.callback(
        `${i} ${i === 1 ? 'взрослый' : 'взрослых'}`,
        `adults_${i}`
      ),
    ]);
  }
  return Markup.inlineKeyboard(buttons);
}

// Клавиатура для выбора количества детей
export function childrenKeyboard() {
  const buttons = [];
  for (let i = 0; i <= 3; i++) {
    const label =
      i === 0
        ? 'Без детей'
        : `${i} ${i === 1 ? 'ребёнок' : i <= 4 ? 'ребёнка' : 'детей'}`;
    buttons.push([Markup.button.callback(label, `children_${i}`)]);
  }
  return Markup.inlineKeyboard(buttons);
}

// Клавиатура для выбора возраста ребёнка
export function ageKeyboard() {
  const buttons = [];
  // Возраст от 0 до 15 лет
  for (let age = 0; age <= 15; age += 2) {
    const row = [];
    if (age <= 12) {
      row.push(Markup.button.callback(`${age} лет`, `age_${age}`));
      if (age + 1 <= 15) {
        row.push(Markup.button.callback(`${age + 1} лет`, `age_${age + 1}`));
      }
    }
    if (row.length > 0) buttons.push(row);
  }
  return Markup.inlineKeyboard(buttons);
}

// Клавиатура для выбора класса отеля
export function hotelClassKeyboard() {
  const buttons = [
    [Markup.button.callback('3 ★', 'hotel_3')],
    [Markup.button.callback('4 ★', 'hotel_4')],
    [Markup.button.callback('5 ★', 'hotel_5')],
    [Markup.button.callback('Любой класс', 'hotel_any')],
  ];
  return Markup.inlineKeyboard(buttons);
}

// Клавиатура для выбора типа размещения
export function hotelTypeKeyboard() {
  const buttons = [
    [Markup.button.callback('🏨 Отель', 'place_hotel')],
    [Markup.button.callback('🏠 Пансионат', 'place_pansion')],
    [Markup.button.callback('🏡 Гостевой дом', 'place_guest')],
    [Markup.button.callback('🏢 Апартаменты', 'place_apart')],
    [Markup.button.callback('🏰 Вилла', 'place_villa')],
    [Markup.button.callback('🛏️ Хостел', 'place_hostel')],
    [Markup.button.callback('✓ Любой тип', 'place_any')],
  ];
  return Markup.inlineKeyboard(buttons);
}

// Клавиатура для выбора типа питания
export function mealKeyboard() {
  const buttons = [
    [Markup.button.callback('🍳 Только завтрак', 'meal_bb')],
    [Markup.button.callback('🍽️ Завтрак и ужин', 'meal_hb')],
    [Markup.button.callback('🥗 Полный пансион', 'meal_fb')],
    [Markup.button.callback('🏖️ Всё включено', 'meal_ai')],
    [Markup.button.callback('✨ Ультра всё включено', 'meal_uai')],
  ];
  return Markup.inlineKeyboard(buttons);
}

// Клавиатура для выбора рейтинга отеля
export function ratingKeyboard() {
  const buttons = [
    [Markup.button.callback('⭐ 3.0+', 'rating_3.0')],
    [Markup.button.callback('⭐⭐ 3.5+', 'rating_3.5')],
    [Markup.button.callback('⭐⭐⭐ 4.0+', 'rating_4.0')],
    [Markup.button.callback('⭐⭐⭐⭐ 4.5+', 'rating_4.5')],
  ];
  return Markup.inlineKeyboard(buttons);
}
