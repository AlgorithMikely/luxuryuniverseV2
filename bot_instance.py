# This file exists to break a circular import between the API and the bot.
# The bot instance is set here by bot_main.py on startup.
# The API can then import it from here without depending on the full bot_main.py module.
bot = None
