export function canViewContact({
  eventStatus,
  eventReleasedCalculationRunId,
  matchCalculationRunId,
  matchStatus,
  viewerParticipantId,
  targetParticipantId,
  maleParticipantId,
  femaleParticipantId,
}) {
  if (eventStatus !== "released") {
    return { ok: false, reason: "event_not_released" };
  }

  if (
    !eventReleasedCalculationRunId ||
    eventReleasedCalculationRunId !== matchCalculationRunId
  ) {
    return { ok: false, reason: "not_current_released_run" };
  }

  if (matchStatus !== "released") {
    return { ok: false, reason: "match_not_released" };
  }

  const isMaleViewer = viewerParticipantId === maleParticipantId;
  const isFemaleViewer = viewerParticipantId === femaleParticipantId;
  if (!isMaleViewer && !isFemaleViewer) {
    return { ok: false, reason: "viewer_not_party" };
  }

  const expectedTarget = isMaleViewer ? femaleParticipantId : maleParticipantId;
  if (targetParticipantId !== expectedTarget) {
    return { ok: false, reason: "target_not_counterparty" };
  }

  return { ok: true };
}
