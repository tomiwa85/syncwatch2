-- CreateEnum
CREATE TYPE "PlaybackControl" AS ENUM ('EVERYONE', 'HOST');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "playbackControl" "PlaybackControl" NOT NULL DEFAULT 'EVERYONE';
