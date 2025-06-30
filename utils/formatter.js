function formatApplication(data) {
    return `
  🌟 *Новая заявка на подбор тура!* 🌟
  
  *Имя:* ${data.name}
  ${data.phone ? `*Телефон:* ${data.phone}\n` : ''}
  *Город вылета:* ${data.city}
  *Направление:* ${data.destination}
  *Период:* ${data.travelPeriod || 'Не указано'}
  ${
    data.departureDate
      ? `*Даты:* ${data.departureDate} - ${data.returnDate}\n`
      : ''
  }
  *Ночей:* ${data.nights}
  *Состав группы:* ${data.companions}
  ${data.childrenInfo ? `*Дети:* ${data.childrenInfo}\n` : ''}
  *Тип отдыха:* ${data.tourType}
  *Размещение:* ${data.accommodation}
  *Бюджет:* ${data.budget}
   ${data} `;
}
function formatTourData({ destination, dates, budget }) {
  return `🌍 Направление: ${destination}\n📅 Даты: ${dates}\n💰 Бюджет: ${budget}`;
}

module.exports = { formatApplication, formatTourData };