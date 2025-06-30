module.exports = async(ctx) => {
    if (!ctx.message) {
        await ctx.reply('Укажите ваш телефон');
        return ctx.wizard.next();
    }

    ctx.wizard.state.phone = ctx.message.text;
    await ctx.reply('Спасибо! Ваша заявка принята.');
    return ctx.scene.leave();
};