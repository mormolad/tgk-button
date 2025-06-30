const { Markup } = require('telegraf');

module.exports = async(ctx) => {
    ctx.wizard.state.destination = ctx.message.text;
    await ctx.reply(
        'В какое время года планируете путешествие? 📅',
        Markup.keyboard([
            ['Июль-Август ☀️', 'Сентябрь-Октябрь 🍂'],
            ['Ноябрь-Март ❄️', 'Апрель-Июнь 🌸'],
            ['Конкретные даты'],
        ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
};