const LocalSession = require('telegraf-session-local');

const localSession = new LocalSession({
  database: 'session/session_db.json',
});

module.exports = localSession.middleware();
