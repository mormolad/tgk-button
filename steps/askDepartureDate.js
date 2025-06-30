module.exports = async(ctx) => {
    if (!ctx.message) {
        await ctx.reply('Укажите дату выезда (дд.мм.гггг)');
        return ctx.wizard.next();
    }

    ctx.wizard.state.departureDate = ctx.message.text;
    await ctx.reply('Укажите дату возвращения (дд.мм.гггг)');

    return ctx.wizard.next();
};