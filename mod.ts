import * as harmony from "https://code.harmony.rocks/v2.5.1/deploy";
import {
  ButtonStyle,
  MessageComponentData,
} from "https://code.harmony.rocks/v2.5.1/src/types/messageComponents.ts";
import { isMessageComponentInteraction } from "https://code.harmony.rocks/v2.5.1/src/utils/interactions.ts";
import ecoji from "https://esm.sh/ecoji-js";

harmony.init({ env: true });

harmony.client.on("interactionError", console.error);

export enum Cell { None, X, O }

export interface Game {
  map: Uint8Array;
  turn: number;
  turnOf: number;
  users: [string, string];
}

export function serialize(game: Game): string {
  const buf = new Uint8Array(9 + 1 + 1 + 16);
  buf.set(game.map, 0);
  buf[9] = game.turn;
  buf[10] = game.turnOf;
  const view = new DataView(buf.buffer);
  view.setBigUint64(11, BigInt(game.users[0]), false);
  view.setBigUint64(19, BigInt(game.users[1]), false);
  return ecoji.encode(
    [...buf].map((e) => e.toString(16).padStart(2, "0")).join(""),
  );
}

export function deserialize(state: string): Game {
  const buf = new Uint8Array(
    (ecoji.decode(state) as string).match(/(\d|\w){2}/g)!.map((e) =>
      parseInt(e, 16)
    ),
  );

  const view = new DataView(buf.buffer);
  return {
    map: buf.slice(0, 9),
    turn: buf[9],
    turnOf: buf[10],
    users: [
      view.getBigUint64(11, false).toString(),
      view.getBigUint64(19, false).toString(),
    ],
  };
}

export const commands: harmony.SlashCommandPartial[] = [
  {
    name: "play",
    description: "Start playing TicTacToe.",
    options: [
      {
        name: "user",
        description: "User to play with. Leave empty for playing with bot.",
        type: "USER",
        required: false,
      },
    ],
  },
  {
    name: "invite",
    description: "Invite me to your server.",
  },
];

harmony.commands.all().then((cmds) => {
  console.log("Fetched Commands", cmds.size);
  console.log("Exptected Size", commands.length);
  if (cmds.size !== commands.length) {
    console.log("Syncing Commands...");
    harmony.commands.bulkEdit(commands).then(() => {
      console.log("Synced!");
    });
  }
});

// Just an ID to know that user is playing with Bot/Computer
const BOT_ID = "783937840752099332";

export function allEqual(arr: any[], val: any) {
  return arr.every((e) => e === val);
}

export type Winner = 0 | 1 | 2 | 3;

export function checkWin(this: Game): Winner | undefined {
  const m = this.map;
  let winner: Winner | undefined = undefined;

  this.users.forEach((id, i) => {
    if (winner) return;

    let u: Winner;
    if (id === BOT_ID) {
      u = 3;
    } else {
      u = i + 1 as Winner;
    }

    const s = i + 1;

    if (
      allEqual([m[0], m[1], m[2]], s) ||
      allEqual([m[3], m[4], m[5]], s) ||
      allEqual([m[6], m[7], m[8]], s) ||
      allEqual([m[0], m[4], m[8]], s) ||
      allEqual([m[2], m[4], m[6]], s) ||
      allEqual([m[0], m[3], m[6]], s) ||
      allEqual([m[2], m[5], m[8]], s) ||
      allEqual([m[1], m[4], m[7]], s)
    ) {
      winner = u;
    }
  });

  if (!winner && !this.map.includes(Cell.None)) return 0;

  return winner;
}

export function GameComponent(game: Game): {
  content: string;
  components: MessageComponentData[];
  allowedMentions: { parse: [] };
} {
  const win = checkWin.bind(game)();

  const d2map = [[...game.map.slice(0, 3)], [...game.map.slice(3, 6)], [
    ...game.map.slice(6, 9),
  ]];

  let ctr = -1;
  return {
    allowedMentions: { parse: [] },
    content: win === undefined
      ? `Turn ${game.turn} | ${
        game.users[game.turnOf] === BOT_ID
          ? "Bot"
          : `<@${game.users[game.turnOf]}>`
      }'s turn`
      : win === 0
      ? "It was a tie!"
      : win === 1 || win === 2
      ? `<@${game.users[win - 1]}> has won!`
      : "Bot has won!",
    components: [
      ...d2map.map((e): MessageComponentData => {
        return {
          type: 1,
          components: e.map((e): MessageComponentData => {
            ctr++;
            return {
              type: 2,
              label: e === Cell.X ? "X" : e === Cell.O ? "O" : "\u200b",
              disabled: win === undefined ? false : true,
              customID: `${ecoji.encode(ctr.toString())}::${serialize(game)}`,
              style: e === Cell.X
                ? ButtonStyle.RED
                : e === Cell.O
                ? ButtonStyle.BLURPLE
                : ButtonStyle.GREY,
            };
          }),
        };
      }),
      {
        type: 1,
        components: [
          {
            type: 2,
            label: "Leave",
            disabled: win === undefined ? false : true,
            customID: `${ecoji.encode("leave")}::${serialize(game)}`,
            style: ButtonStyle.DANGER,
          },
        ],
      },
    ],
  };
}

harmony.handle("play", async (d) => {
  const user = d.option<harmony.InteractionUser | undefined>("user")?.id ?? BOT_ID;
  if (d.option<harmony.InteractionUser | undefined>("user")?.bot) {
    return d.reply("Cannot play with a Bot!", { ephemeral: true });
  }

  const rand = user === BOT_ID ? 0 : Math.floor(Math.random() * 2);

  const game: Game = {
    map: new Uint8Array(9),
    turn: 1,
    turnOf: 0,
    users: [d.user.id, user],
  };

  if (rand === 1) game.users.reverse();

  await d.reply(GameComponent(game));
});

export function playBotTurn(this: Game) {
  if (checkWin.bind(this)() !== undefined) return;
  const left: number[] = [];
  this.map.forEach((e, i) => {
    if (e === Cell.None) left.push(i);
  });
  if (left.length === 0) return;

  let choose;
  const isn = (v: number) => this.map[v] === Cell.None;
  const isx = (v: number) => this.map[v] === Cell.X;
  const iso = (v: number) => this.map[v] === Cell.O;

  const trip = (a: number, b: number, c: number) => {
    if (((isx(a) && isx(b)) || (iso(a) && iso(b))) && isn(c)) return c;
    else if (((isx(b) && isx(c)) || (iso(b) && iso(c))) && isn(a)) return a;
    else if (((isx(a) && isx(c)) || (iso(a) && iso(c))) && isn(b)) return b;
    else return false;
  };

  if (left.length === 1) {
    choose = left[0];
  } else if (typeof trip(0, 1, 2) === "number") {
    choose = trip(0, 1, 2) as number;
  } else if (typeof trip(3, 4, 5) === "number") {
    choose = trip(3, 4, 5) as number;
  } else if (typeof trip(6, 7, 8) === "number") {
    choose = trip(6, 7, 8) as number;
  } else if (typeof trip(0, 3, 6) === "number") {
    choose = trip(0, 3, 6) as number;
  } else if (typeof trip(1, 4, 7) === "number") {
    choose = trip(1, 4, 7) as number;
  } else if (typeof trip(2, 5, 8) === "number") {
    choose = trip(2, 5, 8) as number;
  } else if (typeof trip(0, 4, 8) === "number") {
    choose = trip(0, 4, 8) as number;
  } else if (typeof trip(2, 4, 6) === "number") {
    choose = trip(2, 4, 6) as number;
  } else {
    choose = left[Math.floor(Math.random() * left.length)];
  }

  this.map[choose] = Cell.O;
}

harmony.client.on("interaction", async (d) => {
  if (isMessageComponentInteraction(d)) {
    if (!d.customID.includes("::")) return;
    const [enc1, enc2] = d.customID.split("::");
    const game = deserialize(enc2);
    if (!game.users.includes(d.user.id)) return d.respond({ type: 6 });
    const action = ecoji.decode(enc1) as string;

    if (action.match(/\d/)) {
      const cell = Number(action);
      if (cell < 0 || cell >= 9) return d.respond({ type: 6 });
      if (game.map[cell] !== Cell.None) return d.respond({ type: 6 });
      const idx = game.users.findIndex((e) => e === d.user.id);
      if (idx !== game.turnOf) return d.respond({ type: 6 });
      game.map[cell] = idx === 0 ? Cell.X : Cell.O;
      game.turnOf ^= 1;
      game.turn++;
      if (game.turnOf === 1 && game.users[1] === BOT_ID) {
        playBotTurn.bind(game)();
        game.turn++;
        game.turnOf ^= 1;
      }
      await d.respond({ type: 7, ...GameComponent(game) });
    } else if (action === "leave") {
      await d.respond({
        content: `<@${d.user.id}> has left the game.`,
        allowedMentions: { parse: [] },
        components: GameComponent(game).components.map((e) => {
          e.components = e.components!.map((e) => {
            e.disabled = true;
            return e;
          });
          return e;
        }),
        type: 7,
      });
    } else d.respond({ type: 6 });
  }
});

harmony.handle("invite", (d) => {
  d.reply(
    "• [Click here to Invite.](<https://discord.com/api/oauth2/authorize?client_id=834996135327825950&scope=applications.commands>)\n• [Support me on Ko-fi.](<https://ko-fi.com/DjDeveloper>)\n• Made by [DjDeveloper#7777](<https://discord.com/users/422957901716652033>).",
    { ephemeral: true },
  );
});
