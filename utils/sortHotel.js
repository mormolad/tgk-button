function processHotelData(responseData) {
  // Проверка наличия необходимых данных
  if (!responseData?.data?.block || !responseData?.data?.decode?.hotels) {
    throw new Error('Invalid data structure');
  }

  const result = [];

  // 1. Собираем все доступные туры из блоков
  const allTours = [];

  for (const block of responseData.data.block) {
    if (!block.hotel) continue;

    for (const hotelBlock of block.hotel) {
      if (hotelBlock.tour) {
        // Обработка отелей с несколькими турами
        for (const tour of hotelBlock.tour) {
          allTours.push({
            hotelId: hotelBlock.id,
            tourData: tour,
          });
        }
      } else {
        // Обработка отелей с одним туром
        allTours.push({
          hotelId: hotelBlock.id,
          tourData: hotelBlock,
        });
      }
    }
  }

  // 2. Сортируем туры по цене (по возрастанию)
  allTours.sort((a, b) => a.tourData.prclean - b.tourData.prclean);

  // 3. Берем топ-10 самых дешевых туров
  const topTours = allTours.slice(0, 10);

  // 4. Формируем результат
  for (const tour of topTours) {
    const hotelId = tour.hotelId;
    const hotelInfo = responseData.data.decode.hotels[hotelId];

    if (!hotelInfo) continue;

    // Форматирование цены
    const price = new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 0,
    }).format(tour.tourData.prclean);

    // Форматирование расстояния до моря
    const seaDistance = hotelInfo.seadistance
      ? `${hotelInfo.seadistance} м до моря`
      : 'расстояние неизвестно';

    result.push({
      name: hotelInfo.name,
      stars: `${hotelInfo.stars}*`,
      location: `${hotelInfo.subregion || hotelInfo.region}, ${seaDistance}`,
      rating: hotelInfo.rating || 'нет оценок',
      description: hotelInfo.desc,
      price: `${price} РУБ`,
      photos: hotelInfo.photo?.slice(0, 5) || [], // первые 5 фото
    });
  }

  return result;
}

module.exports = processHotelData;
