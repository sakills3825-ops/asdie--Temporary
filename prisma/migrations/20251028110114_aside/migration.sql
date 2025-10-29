-- CreateTable
CREATE TABLE "BrowserTab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "favicon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HistoryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "visitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "favicon" TEXT,
    "visits" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'root',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "favicon" TEXT,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "BookmarkTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookmarkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookmarkTag_bookmarkId_fkey" FOREIGN KEY ("bookmarkId") REFERENCES "Bookmark" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'settings-1',
    "theme" TEXT NOT NULL DEFAULT 'auto',
    "zoomLevel" REAL NOT NULL DEFAULT 1.0,
    "language" TEXT NOT NULL DEFAULT 'en',
    "startPage" TEXT NOT NULL DEFAULT 'about:blank',
    "restorePreviousSession" BOOLEAN NOT NULL DEFAULT true,
    "enableNotifications" BOOLEAN NOT NULL DEFAULT true,
    "enableCookies" BOOLEAN NOT NULL DEFAULT true,
    "cacheSize" INTEGER NOT NULL DEFAULT 500,
    "historyAutoDeleteDays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SessionData" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'session-1',
    "activeTabId" TEXT,
    "openTabs" TEXT NOT NULL DEFAULT '[]',
    "windowState" TEXT,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MigrationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "BrowserTab_url_idx" ON "BrowserTab"("url");

-- CreateIndex
CREATE INDEX "BrowserTab_isActive_idx" ON "BrowserTab"("isActive");

-- CreateIndex
CREATE INDEX "BrowserTab_updatedAt_idx" ON "BrowserTab"("updatedAt");

-- CreateIndex
CREATE INDEX "HistoryEntry_url_idx" ON "HistoryEntry"("url");

-- CreateIndex
CREATE INDEX "HistoryEntry_visitedAt_idx" ON "HistoryEntry"("visitedAt");

-- CreateIndex
CREATE INDEX "HistoryEntry_title_idx" ON "HistoryEntry"("title");

-- CreateIndex
CREATE INDEX "HistoryEntry_visitedAt_url_idx" ON "HistoryEntry"("visitedAt", "url");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_url_key" ON "Bookmark"("url");

-- CreateIndex
CREATE INDEX "Bookmark_folder_idx" ON "Bookmark"("folder");

-- CreateIndex
CREATE INDEX "Bookmark_createdAt_idx" ON "Bookmark"("createdAt");

-- CreateIndex
CREATE INDEX "Bookmark_url_idx" ON "Bookmark"("url");

-- CreateIndex
CREATE INDEX "BookmarkTag_bookmarkId_idx" ON "BookmarkTag"("bookmarkId");

-- CreateIndex
CREATE INDEX "BookmarkTag_name_idx" ON "BookmarkTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BookmarkTag_bookmarkId_name_key" ON "BookmarkTag"("bookmarkId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationLog_name_key" ON "MigrationLog"("name");
