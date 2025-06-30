const { formatTourData } = require('../utils/formatter');

const ADMIN_ID = process.env.ADMIN_CHAT_ID; // <-- замени на реальный Telegram ID администратора

module.exports = async(ctx) => {
    if (ctx.message.text) {
        ctx.wizard.state.budget = ctx.message.text;
    }

    const summary = formatTourData(ctx.wizard.state);

    // Формируем ссылку на чат с пользователем
    const user = ctx.message.from;
    const userLink = `tg://user?id=${user.id}`; // для Telegram клиента это тоже работает

    // Ответ пользователю с ссылкой
    await ctx.reply(
        `Вот что я понял:\n${summary}\n\nСпасибо! Мы свяжемся с вами с подходящими предложениями.\n\n` +
        `Если хотите, вы можете написать нам напрямую:  https://t.me/TvoiTouragent`
    );

    // Отправка админу с информацией и ссылкой на пользователя
    try {
        await ctx.telegram.sendMessage(
            ADMIN_ID,
            `Новая заявка на тур:\n${summary}\n\nПользователь: ${user.first_name} ${
        user.last_name || ''
      }\n` + `Ссылка: ${userLink}`
        );
    } catch (error) {
        console.error('Ошибка при отправке администратору:', error);
    }

    return ctx.scene.leave();
};