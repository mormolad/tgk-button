
const { Markup } = require('telegraf');module.exports = async(ctx) => {
    if (!ctx.message) {
        await ctx.reply('Как к вам обращаться?');
        return ctx.wizard.next();
    }

    // Клавиатура для запроса телефона
    const contactKeyboard = {
        keyboard: [
            [{
                text: '📞 Отправить телефон',
                request_contact: true,
            }, ],
            ['Пропустить'],
        ],
        resize_keyboard: true,
    };

    await ctx.reply(
        'Оставьте телефон для связи 📱',
        Markup.keyboard(contactKeyboard.keyboard).resize()
    );

    return ctx.wizard.next();
};