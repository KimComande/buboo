export function createSeedData({
  slug = "demo",
  eventDate = "2026-05-21",
  title = defaultEventTitle(eventDate),
  maleCapacity = 5,
  femaleCapacity = 5,
} = {}) {
  const now = new Date().toISOString();
  const eventId = `EVT-${slug}`;
  const event = {
    id: eventId,
    title,
    eventDate,
    location: "",
    maleCapacity,
    femaleCapacity,
    voteOpensAt: null,
    voteClosesAt: null,
    voteClosedAt: null,
    resultReleasedAt: null,
    releasedCalculationRunId: null,
    status: "voting",
    publicSlug: slug,
    createdAt: now,
    updatedAt: now,
  };

  return {
    members: [],
    events: [event],
    eventParticipants: [
      ...createParticipants(eventId, "male", maleCapacity, now),
      ...createParticipants(eventId, "female", femaleCapacity, now),
    ],
    surveySubmissions: [],
    calculationRuns: [],
    matchResults: [],
    voteStats: [],
    contactViewLogs: [],
  };
}

export function defaultEventTitle(eventDate) {
  return `부부, 호기심에서 결혼까지 (${compactDate(eventDate)})`;
}

function compactDate(eventDate) {
  const date = new Date(`${eventDate}T00:00:00`);
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function createParticipants(eventId, gender, capacity, now) {
  const genderCode = gender === "male" ? "M" : "F";
  return Array.from({ length: capacity }, (_, index) => {
    const seatNo = index + 1;
    return {
      id: `EP-${eventId}-${genderCode}${seatNo}`,
      eventId,
      gender,
      seatNo,
      memberId: null,
      latestSubmissionId: null,
      attendanceStatus: "present",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  });
}
