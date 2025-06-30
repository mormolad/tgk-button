const { Markup } = require('telegraf');

module.exports = async(ctx) => {
    ctx.wizard.state.childrenInfo = ctx.message.text;

    await ctx.reply(
        'Какой тип отдыха предпочитаете?',
        Markup.keyboard([
            ['Пляжный 🏖️', 'Экскурсионный 🏛️'],
            ['Горнолыжный ⛷️', 'SPA/Оздоровление 💆‍♀️'],
            ['Активный 🚵‍♀️', 'Городской 🏙️'],
        ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
};