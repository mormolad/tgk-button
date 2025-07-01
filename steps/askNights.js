const { Markup } = require('telegraf');
module.exports = async(ctx) => {
    if (!ctx.message) {
        await ctx.reply(
            'На сколько ночей планируете? 🌙',
            Markup.keyboard([
                ['7-10 ночей', '10-14 ночей'],
                ['2 недели+', 'Короткий тур (3-5 ночей)'],
            ])
            .oneTime()
            .resize()
        );
        return ctx.wizard.next();
    }

    ctx.wizard.state.nights = ctx.message.text;
    await ctx.reply('Какой тип тура вас интересует?');
    return ctx.wizard.next();
};