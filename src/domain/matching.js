import { choiceListFromSubmission } from "./choices.js";

export function buildMatchResults(submissions, participantGenders) {
  const submissionsByParticipant = new Map(
    submissions.map((submission) => [submission.participantId, submission]),
  );
  const results = [];

  for (const maleSubmission of submissions) {
    if (participantGenders[maleSubmission.participantId] !== "male") continue;

    for (const maleChoice of choiceListFromSubmission(maleSubmission)) {
      if (participantGenders[maleChoice.targetParticipantId] !== "female") continue;

      const femaleSubmission = submissionsByParticipant.get(maleChoice.targetParticipantId);
      if (!femaleSubmission) continue;

      for (const femaleChoice of choiceListFromSubmission(femaleSubmission)) {
        if (femaleChoice.targetParticipantId !== maleSubmission.participantId) continue;

        results.push({
          maleParticipantId: maleSubmission.participantId,
          femaleParticipantId: femaleSubmission.participantId,
          maleChoiceRank: maleChoice.rank,
          femaleChoiceRank: femaleChoice.rank,
          matchCode: `M${maleChoice.rank}-F${femaleChoice.rank}`,
        });
      }
    }
  }

  return results;
}
