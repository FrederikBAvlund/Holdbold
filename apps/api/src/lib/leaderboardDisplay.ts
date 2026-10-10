import type { IconName } from "@/components/ui/Icon";
import type { LeaderboardCategory } from "@/lib/leaderboardsShared";

export const LEADERBOARD_SHORT: Record<LeaderboardCategory, { label: string; unit: string; icon: IconName }> = {
  training_total: { label: "Flest træninger", unit: "træninger", icon: "whistle" },
  match_total: { label: "Flest kampe", unit: "kampe", icon: "ball" },
  training_streak: { label: "Træning i træk", unit: "i træk", icon: "flag" },
  match_streak: { label: "Kampe i træk", unit: "i træk", icon: "flag" },
  goals: { label: "Topscorer", unit: "mål", icon: "ball" },
  assists: { label: "Flest assists", unit: "assists", icon: "star" },
  yellow_cards: { label: "Gule kort", unit: "gule", icon: "alert" },
  red_cards: { label: "Røde kort", unit: "røde", icon: "alert" },
  fines: { label: "Bødekongen", unit: "kr", icon: "receipt" },
  thing_duty: { label: "Tingene med", unit: "gange", icon: "bag" },
  beer_duty: { label: "Øl-ansvarlig", unit: "gange", icon: "beer" },
  motm_wins: { label: "Kampens spiller", unit: "gange", icon: "trophy" }
};

export const LEADERBOARD_GROUPS: Array<{ title: string; categories: LeaderboardCategory[] }> = [
  { title: "Fremmøde", categories: ["training_total", "match_total", "training_streak", "match_streak"] },
  { title: "På banen", categories: ["goals", "assists", "motm_wins", "yellow_cards", "red_cards"] },
  { title: "Uden for banen", categories: ["fines", "beer_duty", "thing_duty"] }
];
