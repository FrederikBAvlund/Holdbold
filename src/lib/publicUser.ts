/**
 * Det, andre på holdet må se om en bruger.
 * Brug altid denne i stedet for `user: true`, så adgangskode-hash, kalendernøgle og Facebook-id aldrig sendes ud.
 */
export const PUBLIC_USER_SELECT = { id: true, name: true, email: true, image: true } as const;
