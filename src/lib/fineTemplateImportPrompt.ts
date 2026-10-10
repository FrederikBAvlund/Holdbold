/** Prompt som brugeren kan give en sprogmodel sammen med deres gamle bøder. */
export const IMPORT_PROMPT = `Jeg skal flytte mit holds bødekatalog fra Teambox over i en ny app. Jeg har vedhæftet mine eksisterende bøder (skærmbilleder, PDF eller tekst).

Lav et Excel-ark (.xlsx) med præcis disse kolonner i første række og én bøde pr. række:

- Navn: bødens navn, fx "For sent til træning"
- Beløb: beløbet i hele kroner som et tal uden "kr" (brug minus for en kredit, fx -10)
- Kategori: præcis én af disse: SoMe, Fælles, Spiller, Diverse
- Beskrivelse: valgfri kort forklaring, ellers tom

Regler:
- Tag alle bøderne med, og find ikke selv på nye.
- Brug "Diverse", hvis du er i tvivl om kategorien.
- Hvis en bøde har flere beløb, så lav en række pr. beløb og skriv forskellen i Navn.
- Giv mig selve Excel-filen til download, ikke en tabel i chatten.`;
