-- Nye hold får det mørke Graphite-tema som standard (eksisterende hold beholder deres valg).
ALTER TABLE "Team" ALTER COLUMN "themePreset" SET DEFAULT 'graphite';
