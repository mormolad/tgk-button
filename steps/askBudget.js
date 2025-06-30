module.exports = async(ctx) => {
    if (!ctx.message) {
        await ctx.reply(
            'Укажите бюджет на человека: 💰',
            Markup.keyboard([
                ['До 50 000 ₽', '50 000 - 100 000 ₽'],
                ['100 000 - 200 000 ₽', '200 000+ ₽'],
            ])
            .oneTime()
            .resize()
        );
        return ctx.wizard.next();
    }

    ctx.wizard.state.budget = ctx.message.text;
    await ctx.reply('Как к вам обращаться?');
    return ctx.wizard.next();
};