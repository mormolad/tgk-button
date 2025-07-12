function buildTourvisorUrl(state) {
  // Маппинг типов питания
  const mealMapping = {
    'Все включено': 1,
    'Завтрак и ужин': 2,
    'Только завтрак': 3,
    'Без питания': 4,
    Любое: 0,
  };

  // Маппинг класса отеля
  const starsMapping = {
    '3 ★': 3,
    '4 ★': 4,
    '5 ★': 5,
    Любой: 0,
  };

  // Основные параметры
  const params = {
    datefrom: state.departureDate.start,
    dateto: state.departureDate.end,
    regular: 1,
    nightsfrom: state.nights,
    nightsto: state.nights,
    adults: state.adults,
    child: state.children,
    meal: mealMapping[state.mealType] || 0,
    rating: parseFloat(state.hotelRating) || 0,
    country: state.destinationCountry.id,
    departure: state.departureCity.id,
    pricefrom: state.budget.min,
    priceto: state.budget.max,
    stars: starsMapping[state.hotelClass] || 0,
  };

  // Добавляем возраст детей
  if (state.children > 0 && state.childrenAges) {
    state.childrenAges.forEach((age, index) => {
      params[`childage${index + 1}`] = age;
    });
  }

  // Формируем строку запроса
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  console.log(`https://tourvisor.ru/xml/modsearch.php?${queryString}`);
  return `https://tourvisor.ru/xml/modsearch.php?${queryString}`;
}
module.exports = buildTourvisorUrl;
