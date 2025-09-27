const { Markup } = require('telegraf');
// Генерация inline-календаря
function generateCalendar(year, month) {
  const date = new Date(year, month, 1);
  const monthName = date.toLocaleString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = (date.getDay() + 6) % 7; // смещаем так, чтобы Пн = 0

  let buttons = [];
  let row = [];

  // Заголовок (название месяца)
  buttons.push([Markup.button.callback(`📅 ${monthName}`, 'noop')]);

  // Дни недели
  buttons.push([
    Markup.button.callback('Пн', 'noop'),
    Markup.button.callback('Вт', 'noop'),
    Markup.button.callback('Ср', 'noop'),
    Markup.button.callback('Чт', 'noop'),
    Markup.button.callback('Пт', 'noop'),
    Markup.button.callback('Сб', 'noop'),
    Markup.button.callback('Вс', 'noop'),
  ]);

  // Пустые кнопки до первого дня
  for (let i = 0; i < firstDay; i++) {
    row.push(Markup.button.callback(' ', 'noop'));
  }

  // Дни месяца
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(
      Markup.button.callback(String(d), `date_${d}_${month + 1}_${year}`)
    );
    if (row.length === 7) {
      buttons.push(row);
      row = [];
    }
  }

  // Остаток
  if (row.length > 0) {
    while (row.length < 7) {
      row.push(Markup.button.callback(' ', 'noop'));
    }
    buttons.push(row);
  }

  // Кнопки навигации (месяц назад/вперёд)
  buttons.push([
    Markup.button.callback('◀️', `prev_${month}_${year}`),
    Markup.button.callback('Отмена', 'cancel_date'),
    Markup.button.callback('▶️', `next_${month}_${year}`),
  ]);

  return Markup.inlineKeyboard(buttons);
}

module.exports = generateCalendar;
