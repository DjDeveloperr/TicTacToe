# TicTacToe Bot

Play Tic-Tac-Toe in Discord using Buttons! I just tried to make it after seeing [this post on Reddit](https://www.reddit.com/r/discordapp/comments/mwaezg/tic_tac_toe_with_discords_new_buttons/).

Fun fact, this bot is _serverless_ and does not keep any state! Entire state is stored in buttons itself.

## Deploy!

While you can invite an existing version [here](https://discord.com/api/oauth2/authorize?client_id=834996135327825950&scope=applications.commands), you can still host it yourself.

You can deploy `mod.ts` on [Deno Deploy](https://deno.com/deploy).

[Click here for a one-click deploy.](https://dash.deno.com/new?url=https://raw.githubusercontent.com/DjDeveloperr/TicTacToe/main/mod.ts&env=TOKEN,PUBLIC_KEY)

After that, you can set "Interactions Endpoint URL" in Developer Portal to the one you get after deploying it.

## License

[MIT licensed.](./LICENSE).

Copyright 2022 © DjDeveloperr
