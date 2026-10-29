// The menu (SPEC §28.1): every feature one tap away, grouped so the parents
// come first. "For Dadi & Dada" leads with what keeps them needed and cared
// for; "What they've given" is their library; "Family" holds everything we
// do together. Nothing is hidden behind a space.

export interface MenuItem {
  href: string;
  title: string;
  note: string;
  icon: string;
}
export interface MenuGroup {
  id: "parents" | "given" | "family";
  title: string;
  items: MenuItem[];
}

export function menuFor(isParent: boolean, parentNames: string): MenuGroup[] {
  const them = parentNames || "your parents";
  const parents: MenuGroup = isParent
    ? {
        id: "parents",
        title: "For you",
        items: [
          { href: "/care", title: "Ask the family for help", note: "Groceries, repairs, a ride; your local helpers", icon: "care" },
          { href: "/safe", title: "Safe & sound", note: "Tell them you're home safe, or that you need help", icon: "shield" },
          { href: "/together", title: "Visits", note: "Who's coming home, and the countdown", icon: "send" },
        ],
      }
    : {
        id: "parents",
        title: `For ${them}`,
        items: [
          { href: "/ask", title: `Ask ${them}`, note: "A recipe, a story, their advice or a blessing", icon: "reply" },
          { href: "/care", title: "Help at their home", note: "Shared tasks and their local helpers", icon: "care" },
          { href: "/safe", title: "Safe & sound", note: "Home safe, heading home, I need help", icon: "shield" },
          { href: "/together", title: "Plan a visit", note: "Dates, gifts, the first meal; a countdown both homes see", icon: "send" },
          { href: "/around", title: "Around their home", note: "The places near them, with your memories", icon: "village" },
        ],
      };
  const given: MenuGroup = {
    id: "given",
    title: isParent ? "What you've given" : "What they've given",
    items: [
      { href: "/kitchen", title: "Recipes", note: isParent ? "Your recipes, and who cooked them" : "Shelved by who cooks them, in their voice", icon: "pot" },
      { href: "/stories", title: "Stories", note: "Bedtime stories in the voices that tell them", icon: "moon" },
      { href: "/advice", title: "Advice & blessings", note: "Answers kept with the question", icon: "bless" },
    ],
  };
  const family: MenuGroup = {
    id: "family",
    title: "Family",
    items: [
      { href: "/bond", title: "Everyone", note: "Home by home, both sides, how we're related", icon: "tree" },
      { href: "/lane", title: "Memories", note: "Albums Muse sorts by event, and the years", icon: "lane" },
      { href: "/rituals", title: "Occasions", note: "Birthdays and festivals, wishes from every home", icon: "calendar" },
      { href: "/together", title: "Together", note: "Quiz night, the cookbook, a word a day, Ludo", icon: "gather" },
      { href: "/gather", title: "Sit together", note: "A reason to be in the same room, on a call", icon: "door" },
    ],
  };
  return [parents, given, family];
}
