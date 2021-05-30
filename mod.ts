import {
  ButtonStyle,
  Client,
  Collection,
  event,
  Interaction,
  InteractionUser,
  isMessageComponentInteraction,
  MessageComponentData,
  MessageComponentInteraction,
  MessageComponentType,
  slash,
  SlashCommandInteraction,
  SlashCommandOptionType,
  SlashCommandPartial,
  User,
} from "https://deno.land/x/harmony@v2.0.0-rc2/mod.ts";
import { TOKEN } from "./config.ts";
import { generate } from "https://deno.land/std@0.94.0/uuid/v4.ts";

export function allEqual(arr: any[], val: any) {
  return arr.every((e) => e === val);
}

export enum State {
  None,
  X,
  O,
}

export type Winner = User | "Computer" | "Tie";

export const games = new Collection<string, Game>();
export function findUserGame(id: string) {
  return games.find((e) =>
    e.users.some((u) => typeof u === "object" && u.id === id)
  );
}

export class Game {
  map = new Uint8Array(3 * 3);
  turn = 1;
  turnOf = 0;
  nonce: string;
  winner?: Winner;
  ended = false;

  constructor(
    public users: [User, User | boolean],
    public d: SlashCommandInteraction,
  ) {
    this.nonce = generate();
  }

  nextTurn() {
    this.turn++;
    this.turnOf = this.turnOf == 0 ? 1 : 0;
    this.nonce = generate();
  }

  buttons(): MessageComponentData[] {
    const map: number[][] = [
      [...this.map.slice(0, 3)],
      [...this.map.slice(3, 6)],
      [...this.map.slice(6, 9)],
    ];

    let i = -1;
    return map.map((e) => {
      return {
        type: MessageComponentType.ActionRow,
        components: e.map((e) => {
          i++;
          return {
            type: MessageComponentType.Button,
            style: e === 0
              ? ButtonStyle.SECONDARY
              : e === 1
              ? ButtonStyle.SUCCESS
              : ButtonStyle.DESTRUCTIVE,
            label: e === 0 ? "\u200b" : e === 1 ? "X" : "O",
            disabled: this.winner || this.ended ? true : false,
            customID: this.winner || this.ended ? "null" : e === 0
              ? `ttt::${i}::${this.nonce}`
              : "null",
          };
        }),
      };
    });
  }

  set(point: number, state: State) {
    this.map.set([state], point);
  }

  get(point: number): State {
    return this.map[point];
  }

  checkWin(): Winner | undefined {
    const m = this.map;
    let winner: Winner | undefined = undefined;

    this.users.forEach((_, i) => {
      if (winner) return;
      const u = typeof _ === "boolean" ? "Computer" : _;
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

    if (!winner && !this.map.includes(State.None)) return "Tie";

    if (winner) {
      games.delete(this.users[0].id);
    }
    return winner;
  }

  checkUserTurn(id: string) {
    if (this.turnOf === 0) return this.users[0].id === id;
    else {
      if (typeof this.users[1] === "boolean") return false;
      else return this.users[1].id === id;
    }
  }

  async playUserTurn(id: string, cell: number, d: MessageComponentInteraction) {
    const state: State | undefined = this.users[0].id === id
      ? State.X
      : typeof this.users[1] === "object" && this.users[1].id === id
      ? State.O
      : undefined;
    if (!state) return;
    if (this.get(cell) !== State.None) return;
    this.set(cell, state);
    const win = this.checkWin();
    if (win) {
      this.winner = win;
    } else {
      this.nextTurn();
    }
    this.checkComputerTurn();
    await this.update(d);
  }

  get isComputerPlaying() {
    return typeof this.users[1] === "boolean";
  }

  checkComputerTurn() {
    if (this.winner || this.ended) return;
    if (!this.isComputerPlaying) return;

    const left: number[] = [];
    this.map.forEach((e, i) => {
      if (e === State.None) left.push(i);
    });
    if (left.length === 0) return;

    let choose;
    const isn = (v: number) => this.get(v) === State.None;
    const isx = (v: number) => this.get(v) === State.X;
    const iso = (v: number) => this.get(v) === State.O;

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

    this.set(choose, State.O);

    const win = this.checkWin();
    if (win) {
      this.winner = win;
    } else {
      this.nextTurn();
    }
  }

  async update(d?: MessageComponentInteraction) {
    try {
      if (this.winner || this.ended) {
        if (games.has(this.users[0].id)) games.delete(this.users[0].id);
      }
      const data = {
        content: this.winner
          ? `Game has ended! ${
            this.winner === "Tie"
              ? "It was a tie!"
              : this.winner === "Computer"
              ? "Computer has won!"
              : `<@${this.winner.id}> has won!`
          }`
          : this.turnOf === 0
          ? `<@${this.users[0].id}>'s turn`
          : `${
            typeof this.users[1] === "boolean"
              ? "Computer's"
              : `<@${this.users[1].id}>'s`
          } turn`,
        components: this.buttons(),
        allowedMentions: {
          parse: [],
        },
      };

      if (d) await d.respond({ type: 7, ...data });
      else await this.d.respond(data);
    } catch (e) {
      console.log(e);
      games.delete(this.users[0].id);
    }
  }
}

export const commands: SlashCommandPartial[] = [
  {
    name: "play",
    description: "Start playing TicTacToe.",
    options: [
      {
        name: "user",
        description:
          "User to play with. Leave empty for playing with computer.",
        type: SlashCommandOptionType.USER,
        required: false,
      },
    ],
  },
  {
    name: "leave",
    description: "Leave game.",
  },
];

export class MyClient extends Client {
  @event()
  ready() {
    console.log("Connected!");
    this.slash.commands.all().then((cmds) => {
      if (cmds.size !== commands.length) {
        this.slash.commands
          .bulkEdit(commands)
          .then(() => console.log("Synced Commands!"));
      }
    });
  }

  @slash()
  async play(d: SlashCommandInteraction) {
    if (findUserGame(d.user.id)) {
      return d.reply("You're already playing!", { ephemeral: true });
    }
    const user = d.option<InteractionUser>("user");
    if (user && findUserGame(user.id)) {
      return d.reply("The other user is already playing!", { ephemeral: true });
    }
    const game = new Game([d.user, user === undefined ? true : user], d);
    games.set(d.user.id, game);
    await game.update();
  }

  @slash()
  async leave(d: SlashCommandInteraction) {
    const game = findUserGame(d.user.id);
    if (!game) return d.reply("You're not even playing!", { ephemeral: true });
    d.reply("Game has ended.");
    game.ended = true;
    await game.d.editResponse({
      content: `<@${d.user.id}> has left the game`,
      components: game.buttons(),
      allowedMentions: { parse: [] },
    }).catch(() => {});
    games.delete(game.users[0].id);
  }

  @event()
  async interactionCreate(d: Interaction) {
    if (isMessageComponentInteraction(d)) {
      if (d.customID === "null") return d.respond({ type: 6 });
      if (d.customID.startsWith("ttt::")) {
        const game = findUserGame(d.user.id);
        if (!game) return;
        const [_, _cell, nonce] = d.customID.split("::");
        const cell = Number(_cell);
        if (game.nonce !== nonce) return d.respond({ type: 6 });
        if (!game.checkUserTurn(d.user.id)) return d.respond({ type: 6 });
        await game.playUserTurn(d.user.id, cell, d);
      }
    }
  }
}

if (import.meta.main) {
  const client = new MyClient();
  console.log("Connecting...");
  client.connect(TOKEN, ["GUILDS", "GUILD_MESSAGES"]);
}
