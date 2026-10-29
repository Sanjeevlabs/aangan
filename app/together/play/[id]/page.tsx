"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dice, LudoBoard, MemoryBoard, Players, TicTacToeBoard } from "@/components/games";
import { Button, EmptyLine, RoomHeader } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { GAME_LOOK, type Move } from "@/lib/games";
import type { Game } from "@/lib/kinds";
import { callName } from "@/lib/people";
import { ago, postJson, useJson } from "@/lib/use-json";

// One game. Your move, or a quiet line saying whose it is. Polls gently while
// someone in another home is thinking.

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { viewer, members } = useViewer();
  const { data, reload } = useJson<{ games: Game[] }>("/api/games");
  const [local, setLocal] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const served = data?.games.find((g) => g.id === id) ?? null;
  const game = local && served && local.moves >= served.moves ? local : served;
  const seat = game ? game.players.indexOf(viewer.id) : -1;
  const mine = Boolean(game && game.status === "playing" && seat === game.turn);

  useEffect(() => {
    if (!game || mine || game.status !== "playing") return;
    const t = window.setInterval(() => void reload(), 4000);
    return () => window.clearInterval(t);
  }, [game, mine, reload]);

  if (data === null) return <div className="skeleton mt-24 h-[360px] rounded-card" aria-busy="true" aria-label="Loading game" />;
  if (!game)
    return (
      <div>
        <RoomHeader title="Game" />
        <EmptyLine>This game has ended.</EmptyLine>
      </div>
    );

  const look = GAME_LOOK[game.game];
  const move = async (m: Move) => {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/games", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "move", gameId: game.id, v: game.moves, move: m }) });
    const out = (await res.json().catch(() => null)) as { game?: Game; error?: string } | null;
    if (out?.game) setLocal(out.game);
    if (!res.ok) setNote(out?.error === "stale" ? "Someone moved first. Here's the board now." : "That move isn't allowed.");
    else setNote(null);
    await reload();
    setBusy(false);
  };

  const last = game.lastMove;
  const lastBy = members.find((x) => x.id === last?.by);
  const turnOf = members.find((x) => x.id === game.players[game.turn]);
  const winner = members.find((x) => x.id === game.winner);
  const status =
    game.status === "done" ? (winner ? (winner.id === viewer.id ? "You won!" : `${callName(winner)} won`) : "It's a draw") : mine ? (game.game === "ludo" && game.state.dice !== null ? "Pick a piece to move" : "Your move") : `${callName(turnOf)}'s move`;

  return (
    <div>
      <RoomHeader title={look.title} subtitle={look.note} />
      <Players game={game} members={members} viewerId={viewer.id} />
      <p className="m-0 mt-5 text-center text-[22px] font-semibold" aria-live="polite">
        {status}
      </p>
      <p className="m-0 mt-1 min-h-[20px] text-center text-[14px] text-ink-soft">{note ?? (last ? `${last.by === viewer.id ? "You" : callName(lastBy)} ${last.text} · ${ago(last.at)}` : "First move")}</p>

      <div className="mt-6">
        {game.game === "tictactoe" && <TicTacToeBoard game={game} canMove={mine && !busy} onMove={(cell) => void move({ cell })} />}
        {game.game === "memory" && <MemoryBoard game={game} members={members} canMove={mine && !busy} onMove={(card) => void move({ card })} />}
        {game.game === "ludo" && (
          <>
            <LudoBoard game={game} viewerSeat={seat} onToken={(token) => void move({ token })} />
            <div className="mt-4 flex items-center justify-center gap-4">
              <Dice value={game.state.dice} />
              {mine && game.state.dice === null && (
                <Button className="h-14 px-8 text-[17px]" disabled={busy} onClick={() => void move({ roll: true })}>
                  Roll
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-10 flex justify-center">
        {game.status === "done" ? (
          <Button
            variant="secondary"
            onClick={async () => {
              const out = await postJson<{ game: Game }>("/api/games", { action: "new", game: game.game, players: [...game.players.slice(1), game.players[0]] });
              if (out) router.replace(`/together/play/${out.game.id}`);
            }}
          >
            Play again
          </Button>
        ) : (
          seat >= 0 && (
            <button
              type="button"
              className="h-11 text-[14px] font-medium text-ink-soft"
              onClick={async () => {
                await postJson("/api/games", { action: "end", gameId: game.id });
                router.replace("/together");
              }}
            >
              End this game
            </button>
          )
        )}
      </div>
    </div>
  );
}
