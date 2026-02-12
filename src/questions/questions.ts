import { SurveyDefinition } from './types';

export const survey: SurveyDefinition = {
  questions: [
    {
      id: 'departureCity',
      type: 'multipleChoice',
      text: '🛫 1/10: Город вылета',
      options: [
        { value: 'moscow', label: 'Москва' },
        { value: 'spb', label: 'Санкт-Петербург' },
        { value: 'ekb', label: 'Екатеринбург' },
        { value: 'novosibirsk', label: 'Новосибирск' },
        { value: 'kazan', label: 'Казань' },
        { value: 'other', label: 'Другой' },
      ],
    },
    {
      id: 'destinationCountry',
      type: 'multipleChoice',
      text: '🏝️ 2/10: Страна отдыха',
      options: [
        { value: 'turkey', label: 'Турция' },
        { value: 'egypt', label: 'Египет' },
        { value: 'uae', label: 'ОАЭ' },
        { value: 'thailand', label: 'Таиланд' },
        { value: 'russia', label: 'Россия' },
        { value: 'other', label: 'Другая' },
      ],
    },
    {
      id: 'departureDate',
      type: 'date',
      text: '📅 3/10: Выберите дату вылета',
    },
    {
      id: 'nights',
      type: 'multipleChoice',
      text: '🌙 4/10: Количество ночей',
      options: [
        { value: '7', label: '7 ночей' },
        { value: '10', label: '10 ночей' },
        { value: '14', label: '14 ночей' },
      ],
    },
    {
      id: 'adults',
      type: 'multipleChoice',
      text: '👤 5/10: Количество взрослых',
      options: [
        { value: '1', label: '1 взрослый' },
        { value: '2', label: '2 взрослых' },
        { value: '3', label: '3 взрослых' },
        { value: '4', label: '4 взрослых' },
      ],
    },
    {
      id: 'children',
      type: 'multipleChoice',
      text: '👶 6/10: Количество детей',
      options: [
        { value: '0', label: 'Без детей' },
        { value: '1', label: '1 ребёнок' },
        { value: '2', label: '2 ребёнка' },
        { value: '3', label: '3 ребёнка' },
      ],
    },
    {
      id: 'hotelClass',
      type: 'multipleChoice',
      text: '🏨 7/10: Класс отеля',
      options: [
        { value: '3', label: '3 ★' },
        { value: '4', label: '4 ★' },
        { value: '5', label: '5 ★' },
        { value: 'any', label: 'Любой класс' },
      ],
    },
    {
      id: 'hotelType',
      type: 'multipleChoice',
      text: '🏨 8/10: Тип размещения',
      options: [
        { value: 'hotel', label: '🏨 Отель' },
        { value: 'pansion', label: '🏠 Пансионат' },
        { value: 'guest', label: '🏡 Гостевой дом' },
        { value: 'apart', label: '🏢 Апартаменты' },
        { value: 'villa', label: '🏰 Вилла' },
        { value: 'hostel', label: '🛏️ Хостел' },
        { value: 'any', label: '✓ Любой тип' },
      ],
    },
    {
      id: 'meal',
      type: 'multipleChoice',
      text: '🍽️ 9/10: Питание',
      options: [
        { value: 'bb', label: '🍳 Только завтрак' },
        { value: 'hb', label: '🍽️ Завтрак и ужин' },
        { value: 'fb', label: '🥗 Полный пансион' },
        { value: 'ai', label: '🏖️ Всё включено' },
        { value: 'uai', label: '✨ Ультра всё включено' },
      ],
    },
    {
      id: 'rating',
      type: 'multipleChoice',
      text: '⭐ 10/10: Минимальный рейтинг отеля',
      options: [
        { value: '3.0', label: '⭐ 3.0+' },
        { value: '3.5', label: '⭐⭐ 3.5+' },
        { value: '4.0', label: '⭐⭐⭐ 4.0+' },
        { value: '4.5', label: '⭐⭐⭐⭐ 4.5+' },
      ],
    },
  ],
};
