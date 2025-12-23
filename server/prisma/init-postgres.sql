-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT UNIQUE,
    "username" TEXT UNIQUE,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "access_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL UNIQUE,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP,
    "usedByIp" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "assessments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "accessCodeId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "attachmentStyle" TEXT NOT NULL,
    "dimensions" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "aiAnalysis" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assessments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assessments_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "access_codes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "access_codes_code_isUsed_idx" ON "access_codes"("code", "isUsed");
CREATE INDEX IF NOT EXISTS "assessments_userId_idx" ON "assessments"("userId");
CREATE INDEX IF NOT EXISTS "assessments_createdAt_idx" ON "assessments"("createdAt");
CREATE INDEX IF NOT EXISTS "assessments_accessCodeId_idx" ON "assessments"("accessCodeId");
