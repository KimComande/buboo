export const NONE_CHOICE = "none";

export function validateChoicePair(firstChoiceId, secondChoiceId) {
  if (firstChoiceId === NONE_CHOICE && secondChoiceId !== NONE_CHOICE) {
    return { ok: false, reason: "first_none_second_present" };
  }

  if (
    firstChoiceId !== NONE_CHOICE &&
    secondChoiceId !== NONE_CHOICE &&
    firstChoiceId === secondChoiceId
  ) {
    return { ok: false, reason: "duplicate_choice" };
  }

  return { ok: true };
}

export function resolveChoice({ targetParticipantId, activeTargetIds }) {
  if (targetParticipantId === NONE_CHOICE) {
    return { status: "none", targetParticipantId: null };
  }

  const activeTargets = new Set(activeTargetIds);
  if (!activeTargets.has(targetParticipantId)) {
    return { status: "invalid", reason: "target_not_active" };
  }

  return { status: "resolved", targetParticipantId };
}

export function choiceListFromSubmission(submission) {
  return [
    { rank: 1, targetParticipantId: submission.firstChoiceId },
    { rank: 2, targetParticipantId: submission.secondChoiceId },
  ].filter((choice) => choice.targetParticipantId && choice.targetParticipantId !== NONE_CHOICE);
}
