module.exports = async(ctx) => {
    if (!ctx.message) {
        await ctx.reply('Из какого города планируете вылет? 🏙️');
        return ctx.wizard.next();
    }

    ctx.wizard.state.city = ctx.message.text;
    await ctx.reply('Куда хотите поехать? 🌍 (Страна, курорт или "море/горы")');
    return ctx.wizard.next();
};