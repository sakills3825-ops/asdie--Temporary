-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BrowserTab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "favicon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BrowserTab" ("createdAt", "favicon", "id", "isActive", "title", "updatedAt", "url") SELECT "createdAt", "favicon", "id", "isActive", "title", "updatedAt", "url" FROM "BrowserTab";
DROP TABLE "BrowserTab";
ALTER TABLE "new_BrowserTab" RENAME TO "BrowserTab";
CREATE INDEX "BrowserTab_url_idx" ON "BrowserTab"("url");
CREATE INDEX "BrowserTab_isActive_idx" ON "BrowserTab"("isActive");
CREATE INDEX "BrowserTab_updatedAt_idx" ON "BrowserTab"("updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
