-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "access_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "usedByIp" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "assessments" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "access_codes_code_key" ON "access_codes"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "access_codes_code_isUsed_idx" ON "access_codes"("code", "isUsed");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assessments_userId_idx" ON "assessments"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assessments_createdAt_idx" ON "assessments"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assessments_accessCodeId_idx" ON "assessments"("accessCodeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "admins_email_key" ON "admins"("email");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessments_userId_fkey') THEN
        ALTER TABLE "assessments" ADD CONSTRAINT "assessments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessments_accessCodeId_fkey') THEN
        ALTER TABLE "assessments" ADD CONSTRAINT "assessments_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "access_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
