const { Markup } = require('telegraf');

module.exports = async(ctx) => {
    ctx.wizard.state.tourType = ctx.message.text;

    await ctx.reply(
        'Какое размещение предпочитаете? 🏨',
        Markup.keyboard([
            ['Всё включено 🍹', 'Только завтраки ☕'],
            ['Апартаменты 🏠', 'Бутик-отель'],
            ['Не важно'],
        ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
};