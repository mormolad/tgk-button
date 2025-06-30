module.exports = async(ctx) => {
    if (!ctx.message) {
        await ctx.reply('Укажите дату возвращения (дд.мм.гггг)');
        return ctx.wizard.next();
    }
};