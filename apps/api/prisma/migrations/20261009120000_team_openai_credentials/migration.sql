CREATE TABLE "TeamOpenAiCredential" (
    "teamId" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    CONSTRAINT "TeamOpenAiCredential_pkey" PRIMARY KEY ("teamId")
);
ALTER TABLE "TeamOpenAiCredential" ADD CONSTRAINT "TeamOpenAiCredential_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
