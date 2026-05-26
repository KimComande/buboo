import { choiceListFromSubmission } from "./choices.js";

const SCORE_BY_RANK = {
  1: 2,
  2: 1,
};

export function calculateVoteStats(participants, submissions) {
  const statsByParticipant = new Map(
    participants.map((participant) => [
      participant.id,
      {
        participantId: participant.id,
        gender: participant.gender,
        receivedFirstCount: 0,
        receivedSecondCount: 0,
        score: 0,
        genderRank: null,
      },
    ]),
  );

  for (const submission of submissions) {
    for (const choice of choiceListFromSubmission(submission)) {
      const targetStats = statsByParticipant.get(choice.targetParticipantId);
      if (!targetStats) continue;

      if (choice.rank === 1) targetStats.receivedFirstCount += 1;
      if (choice.rank === 2) targetStats.receivedSecondCount += 1;
      targetStats.score += SCORE_BY_RANK[choice.rank] ?? 0;
    }
  }

  const stats = [...statsByParticipant.values()];
  for (const gender of new Set(stats.map((stat) => stat.gender))) {
    const genderStats = stats.filter((stat) => stat.gender === gender);
    for (const stat of genderStats) {
      if (stat.score <= 0) {
        stat.genderRank = null;
        continue;
      }
      stat.genderRank = 1 + genderStats.filter((other) => other.score > stat.score).length;
    }
  }

  return stats;
}
