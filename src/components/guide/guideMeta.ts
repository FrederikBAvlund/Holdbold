import type { IconName } from "@/components/ui/Icon";
import type { Capability } from "@/lib/guide/capabilities";

/** Hvordan hver del af appen præsenteres i guiden */
export const CAPABILITY_META: Record<Capability, { label: string; icon: IconName; pitch: string }> = {
  basis: {
    label: "Det grundlæggende",
    icon: "ball",
    pitch: "Meld til og fra, få kampene i kalenderen og hold styr på dine bøder."
  },
  events: {
    label: "Begivenheder",
    icon: "calendar",
    pitch: "Opret træninger og kampe, og se hvem der kommer."
  },
  fines: {
    label: "Bødekassen",
    icon: "receipt",
    pitch: "Giv bøder, saml ind og hold styr på betalingerne."
  },
  absences: {
    label: "Fravær",
    icon: "heart",
    pitch: "Godkend skader og fravær, så ingen får bøder for det."
  },
  motm: {
    label: "Kampens spiller",
    icon: "star",
    pitch: "Kør afstemningen efter kampen, og afslør vinderen."
  },
  admin: {
    label: "Holdet",
    icon: "users",
    pitch: "Få spillerne med, fordel rollerne og sæt holdet op."
  }
};
