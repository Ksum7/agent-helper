-- Add sessionId column to FileRecord for chat session-scoped file access
ALTER TABLE "FileRecord" ADD COLUMN "sessionId" TEXT;

-- Add foreign key constraint
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
