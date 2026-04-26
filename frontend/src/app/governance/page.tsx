"use client";

import React, { useMemo, useState } from "react";
import Button from "@/components/ui/Button";

type VoteChoice = "yes" | "no";

interface Proposal {
  id: string;
  title: string;
  description: string;
  quorumRequired: number;
  quorumCurrent: number;
  yesVotes: number;
  noVotes: number;
  userVote?: VoteChoice;
}

const INITIAL_PROPOSALS: Proposal[] = [
  {
    id: "NOVA-101",
    title: "Governance Treasury Allocation for Q2 Grants",
    description:
      "Approve the allocation of 120,000 NOVA from the treasury to ecosystem grants and mentorship bounties.",
    quorumRequired: 50000,
    quorumCurrent: 38600,
    yesVotes: 24100,
    noVotes: 14500,
  },
  {
    id: "NOVA-102",
    title: "Protocol Fee Reduction (2.0% to 1.5%)",
    description:
      "Lower marketplace protocol fees to increase project onboarding while maintaining treasury sustainability.",
    quorumRequired: 45000,
    quorumCurrent: 33200,
    yesVotes: 18200,
    noVotes: 15000,
  },
  {
    id: "NOVA-103",
    title: "Add Voting Power Delegation",
    description:
      "Enable token holders to delegate voting power to trusted delegates for upcoming governance cycles.",
    quorumRequired: 60000,
    quorumCurrent: 51700,
    yesVotes: 34300,
    noVotes: 17400,
  },
];

const USER_VOTING_POWER = 3200;

function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export default function GovernancePage() {
  const [proposals, setProposals] = useState<Proposal[]>(INITIAL_PROPOSALS);

  const totalActiveVotes = useMemo(
    () => proposals.reduce((acc, p) => acc + p.quorumCurrent, 0),
    [proposals],
  );
  const avgQuorumProgress = useMemo(() => {
    if (proposals.length === 0) return 0;
    const value = proposals.reduce((acc, p) => {
      const progress = p.quorumRequired === 0 ? 0 : p.quorumCurrent / p.quorumRequired;
      return acc + progress;
    }, 0);
    return Math.round((value / proposals.length) * 100);
  }, [proposals]);

  const handleVote = (proposalId: string, vote: VoteChoice) => {
    setProposals((prev) =>
      prev.map((proposal) => {
        if (proposal.id !== proposalId) return proposal;
        if (proposal.userVote) return proposal;

        return {
          ...proposal,
          userVote: vote,
          quorumCurrent: proposal.quorumCurrent + USER_VOTING_POWER,
          yesVotes: vote === "yes" ? proposal.yesVotes + USER_VOTING_POWER : proposal.yesVotes,
          noVotes: vote === "no" ? proposal.noVotes + USER_VOTING_POWER : proposal.noVotes,
        };
      }),
    );
  };

  return (
    <div className="relative min-h-screen bg-[#050505] text-foreground overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-primary/20 opacity-40 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-[400px] w-[400px] -translate-y-1/2 rounded-[100%] bg-purple-600/10 opacity-30 blur-[100px]" />

      <main className="container relative mx-auto px-6 py-12 z-10 max-w-7xl">
        <header className="mb-10 lg:mt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6 shadow-[0_0_20px_rgba(var(--primary),0.2)]">
            DAO Governance
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl mb-4">
            Community Proposal Voting
          </h1>
          <p className="text-white/50 font-light leading-relaxed max-w-3xl text-lg">
            Review active proposals, monitor quorum progress, and cast your vote
            with your current voting power.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3 mb-10">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-wide text-zinc-400">Your Voting Power</p>
            <p className="mt-2 text-3xl font-bold text-white">{USER_VOTING_POWER.toLocaleString()} NOVA</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-wide text-zinc-400">Total Active Votes</p>
            <p className="mt-2 text-3xl font-bold text-white">{totalActiveVotes.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-wide text-zinc-400">Average Quorum</p>
            <p className="mt-2 text-3xl font-bold text-white">{avgQuorumProgress}%</p>
          </div>
        </section>

        <section className="space-y-6 pb-12">
          {proposals.map((proposal) => {
            const total = proposal.yesVotes + proposal.noVotes;
            const yesPercent = percentage(proposal.yesVotes, total);
            const noPercent = percentage(proposal.noVotes, total);
            const quorumPercent = percentage(proposal.quorumCurrent, proposal.quorumRequired);

            return (
              <article
                key={proposal.id}
                className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-widest text-primary uppercase">{proposal.id}</p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">{proposal.title}</h2>
                    <p className="mt-2 max-w-3xl text-zinc-400">{proposal.description}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-right">
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Quorum</p>
                    <p className="text-lg font-semibold text-white">
                      {proposal.quorumCurrent.toLocaleString()} / {proposal.quorumRequired.toLocaleString()}
                    </p>
                    <p className="text-xs text-primary">{quorumPercent}% reached</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between text-sm text-zinc-400">
                    <span>Yes ({proposal.yesVotes.toLocaleString()})</span>
                    <span>No ({proposal.noVotes.toLocaleString()})</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div className="flex h-full">
                      <div className="bg-emerald-500" style={{ width: `${yesPercent}%` }} />
                      <div className="bg-rose-500" style={{ width: `${noPercent}%` }} />
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-zinc-500">
                    <span>{yesPercent}% yes</span>
                    <span>{noPercent}% no</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => handleVote(proposal.id, "yes")}
                    disabled={Boolean(proposal.userVote)}
                    className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-6 py-2 text-emerald-300 hover:bg-emerald-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Vote Yes
                  </Button>
                  <Button
                    onClick={() => handleVote(proposal.id, "no")}
                    disabled={Boolean(proposal.userVote)}
                    className="rounded-full border border-rose-500/40 bg-rose-500/10 px-6 py-2 text-rose-300 hover:bg-rose-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Vote No
                  </Button>
                  {proposal.userVote && (
                    <p className="text-sm text-primary">
                      Vote recorded: {proposal.userVote.toUpperCase()} with {USER_VOTING_POWER.toLocaleString()} power.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
