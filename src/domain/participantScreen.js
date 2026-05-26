export function participantScreenState(status) {
  if (status === "ready" || status === "voting") return "vote";
  if (status === "released" || status === "ended") return "result";
  return "preparing";
}
