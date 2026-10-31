"use client";

import { slug } from "@/lib/card-kit";
import { callName, memberPhoto } from "@/lib/people";
import type { Member } from "@/lib/schemas";
import { quoteCard, quoteFrom } from "@/lib/share-cards";
import { canShareQuote, canShareTodayAnswer } from "@/lib/share-rules";
import { ShareButton } from "./share-sheet";
import { useFamilyCards } from "@/lib/use-family";
import { useViewer } from "./viewer";

/**
 * Share what someone said (a story, advice, a blessing, today's answer) as a
 * handwritten quote card, and offer a few of the words as a blessing sticker.
 * Only the words travel, never the voice. Hidden from anyone not allowed:
 * the speaker or an admin for quotes; only the speaker for today's answer.
 */
export function ShareQuote({
  words,
  speaker,
  at,
  context,
  mode = "quote",
  sticker = true,
  className,
  tone = "soft",
  iconOnly = true,
}: {
  words: string;
  speaker: Member | undefined;
  at: string;
  context?: string;
  mode?: "quote" | "today";
  sticker?: boolean;
  className?: string;
  tone?: "soft" | "dark" | "glass" | "paper";
  iconOnly?: boolean;
}) {
  const { viewer } = useViewer();
  const text = quoteFrom(words);
  const allowed = mode === "today" ? canShareTodayAnswer(viewer, speaker?.id) : canShareQuote(viewer, speaker?.id);
  if (!allowed || !speaker || text.length < 2) return null;
  const by = speaker.id === viewer.id ? (speaker.displayName || speaker.firstName) : callName(speaker);
  return (
    <ShareButton
      iconOnly={iconOnly}
      tone={tone}
      className={className}
      label="Share these words"
      target={() => ({
        title: "Share these words",
        note: `Only the words go, in ${speaker.id === viewer.id ? "your" : `${by}’s`} name. Never the voice.`,
        filename: `${slug(`${by} ${text.split(" ").slice(0, 5).join(" ")}`)}.png`,
        text: `“${text}” — ${by}`,
        render: () => quoteCard({ words: text, by, at, tz: speaker.tz, context, photo: memberPhoto(speaker) }),
      })}
      sticker={sticker ? () => ({ kind: "blessing", title: "Sticker from these words", transcript: words, by }) : undefined}
    />
  );
}

/** Today's question: share your own answer (its words), never anyone else's. */
export function ShareTodayAnswer({ cardId, className, tone = "glass" }: { cardId: string; className?: string; tone?: "soft" | "dark" | "glass" | "paper" }) {
  const { viewer, members } = useViewer();
  const { cards } = useFamilyCards();
  const card = cards?.find((c) => c.id === cardId);
  if (!card || card.authorId !== viewer.id) return null;
  const words = card.transcript || card.caption;
  return <ShareQuote mode="today" words={words} speaker={members.find((m) => m.id === viewer.id)} at={card.takenAt} context={"Today\u2019s question"} sticker={false} tone={tone} className={className} />;
}
