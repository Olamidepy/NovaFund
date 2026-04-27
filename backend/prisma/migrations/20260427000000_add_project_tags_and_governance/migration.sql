-- AlterTable: add tags column to projects
ALTER TABLE "projects" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex: GIN index on tags array for fast containment queries (hasSome / hasEvery)
CREATE INDEX "projects_tags_idx" ON "projects" USING GIN ("tags");

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('OPEN', 'QUORUM_REACHED', 'EXECUTED', 'CANCELLED');

-- CreateTable: governance_proposals
CREATE TABLE "governance_proposals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "quorum" INTEGER NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable: governance_signatures
CREATE TABLE "governance_signatures" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "signer_key" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint (one signature per signer per proposal)
CREATE UNIQUE INDEX "governance_signatures_proposal_id_signer_key_key"
    ON "governance_signatures"("proposal_id", "signer_key");

-- AddForeignKey
ALTER TABLE "governance_signatures"
    ADD CONSTRAINT "governance_signatures_proposal_id_fkey"
    FOREIGN KEY ("proposal_id") REFERENCES "governance_proposals"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
