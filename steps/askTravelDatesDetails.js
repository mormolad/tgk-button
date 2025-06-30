const { Markup } = require('telegraf');

module.exports = async(ctx) => {
    ctx.wizard.state.travelPeriod = ctx.message.text;

    if (ctx.message.text === 'Конкретные даты') {
        await ctx.reply('Введите дату вылета (ДД.ММ.ГГГГ):');
        return ctx.wizard.next();
    }

    return ctx.wizard.selectStep(7); // перейти сразу к askNights
};