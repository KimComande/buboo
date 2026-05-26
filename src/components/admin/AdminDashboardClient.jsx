"use client";

import { useEffect, useMemo, useState } from "react";

export default function AdminDashboardClient({ initialSlug }) {
  const [slug, setSlug] = useState(initialSlug);
  const [dashboard, setDashboard] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [message, setMessage] = useState("");
  const [memberKeyword, setMemberKeyword] = useState("");

  useEffect(() => {
    loadDashboard();
  }, [slug]);

  async function loadDashboard() {
    setMessage("");
    try {
      const payload = await api(`/api/admin/events/${slug}/dashboard`);
      setDashboard(payload);
      setSelectedRunId(resolveRunId(payload, selectedRunId));
    } catch (error) {
      if (error.message === "admin_auth_required") {
        window.location.href = "/buboo-ops-local/login";
        return;
      }
      setMessage(error.message);
    }
  }

  async function runAction(success, action) {
    setMessage("");
    try {
      const payload = await action();
      setMessage(success);
      if (payload?.event?.publicSlug && payload.event.publicSlug !== slug) {
        setSlug(payload.event.publicSlug);
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("event", payload.event.publicSlug);
        window.history.replaceState({}, "", nextUrl.toString());
      } else {
        await loadDashboard();
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  const selectedRun = useMemo(() => dashboard?.calculationRuns.find((run) => run.id === selectedRunId) ?? null, [dashboard, selectedRunId]);
  const selectedMatches = useMemo(() => dashboard?.matchResults.filter((match) => match.calculationRunId === selectedRunId) ?? [], [dashboard, selectedRunId]);
  const selectedStats = useMemo(() => dashboard?.voteStats.filter((stat) => stat.calculationRunId === selectedRunId) ?? [], [dashboard, selectedRunId]);
  const selectedLogs = useMemo(() => {
    const matchIds = new Set(selectedMatches.map((match) => match.id));
    return dashboard?.contactViewLogs.filter((log) => matchIds.has(log.matchResultId)) ?? [];
  }, [dashboard, selectedMatches]);

  if (!dashboard) {
    return <main className="admin-shell"><p className="empty-state">{message || "불러오는 중입니다."}</p></main>;
  }

  const submittedCount = dashboard.participants.filter((participant) => participant.latestSubmission).length;
  const duplicateSlots = dashboard.participants.filter((participant) => participant.submissionVersions.length > 1).length;

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="eyebrow">Buboo Operations</p>
          <h1>운영자 화면</h1>
        </div>
        <div className="header-actions">
          <a className="link-button" href={`/e/${slug}`} target="_blank">참가자 링크</a>
          <button className="secondary-button" type="button" onClick={loadDashboard}>새로고침</button>
        </div>
      </header>

      {message ? <p className="inline-message">{message}</p> : null}

      <section className="toolbar-band">
        <CurrentEventSummary event={dashboard.event} />
        <EventCreator onCreate={(body) => runAction("새 모임을 만들었습니다.", () => api("/api/admin/events", { method: "POST", body }))} />
        <div className="action-row">
          <button className="primary-button" type="button" onClick={() => runAction("마감 및 계산을 완료했습니다.", () => api(`/api/admin/events/${slug}/calculate`, { method: "POST", body: {} }))}>마감 및 계산</button>
          <button className="danger-button" type="button" onClick={() => {
            if (!dashboard.latestRun) {
              setMessage("먼저 마감 및 계산을 실행해 주세요.");
              return;
            }
            runAction("결과를 공개했습니다.", () => api(`/api/admin/events/${slug}/release`, { method: "POST", body: { runId: dashboard.latestRun.id } }));
          }}>결과 공개</button>
        </div>
      </section>

      <section className="metric-strip">
        <Metric label="행사 상태" value={statusText(dashboard.event.status)} />
        <Metric label="제출" value={`${submittedCount}/${dashboard.participants.length}`} />
        <Metric label="중복 제출 좌석" value={duplicateSlots} />
        <Metric label="선택 매칭" value={`${selectedMatches.length}건`} />
      </section>

      <section className="panel">
        <div className="section-head inline-head">
          <div>
            <h2>회차 결과</h2>
            <p>계산 회차별 매칭, 호감도, 연락처 열람 상태를 확인합니다.</p>
          </div>
          {dashboard.calculationRuns.length ? (
            <select value={selectedRunId} onChange={(event) => setSelectedRunId(event.target.value)}>
              {dashboard.calculationRuns.map((run) => (
                <option key={run.id} value={run.id}>{runTitle(run)} / {statusText(run.status)}</option>
              ))}
            </select>
          ) : <span className="status-pill">마감 및 계산 후 회차가 표시됩니다</span>}
        </div>
        <div className="metric-strip compact">
          <Metric label="계산 포함" value={selectedRun?.calculationSummary ? `남자 ${selectedRun.calculationSummary.includedMaleCount}명 / 여자 ${selectedRun.calculationSummary.includedFemaleCount}명` : "-"} />
          <Metric label="미제출" value={selectedRun?.calculationSummary ? `${selectedRun.calculationSummary.unsubmittedCount ?? 0}명` : "-"} />
          <Metric label="연락처 열람" value={`${selectedLogs.length}건`} />
        </div>
      </section>

      <section className="dashboard-grid">
        <TablePanel title="매칭 결과" columns={["유형", "남자", "여자", "상태"]}>
          {selectedMatches.length ? selectedMatches.map((match) => (
            <tr key={match.id}>
              <td>{matchCodeText(match.matchCode)}</td>
              <td>{participantSummary(dashboard, match.maleParticipantId)}</td>
              <td>{participantSummary(dashboard, match.femaleParticipantId)}</td>
              <td>{match.status}</td>
            </tr>
          )) : <EmptyRow colSpan={4} text="계산된 매칭이 없습니다." />}
        </TablePanel>

        <TablePanel title="호감도 통계" columns={["순위", "번호", "이름", "1순위", "2순위", "점수"]}>
          {selectedStats.length ? [...selectedStats].sort(compareStat).map((stat) => (
            <tr key={stat.id}>
              <td>{stat.genderRank ?? "득표 없음"}</td>
              <td>{genderText(stat.gender)} {stat.seatNo}</td>
              <td>{stat.name || "-"}<div className="small-text">{stat.nickname || ""}</div></td>
              <td>{stat.receivedFirstCount}</td>
              <td>{stat.receivedSecondCount}</td>
              <td><strong>{stat.score}</strong></td>
            </tr>
          )) : <EmptyRow colSpan={6} text="통계가 없습니다." />}
        </TablePanel>
      </section>

      <TablePanel title="참가자 및 제출 버전" columns={["번호", "상태", "최신 제출", "선택", "버전"]}>
        {dashboard.participants.map((participant) => (
          <tr key={participant.id}>
            <td><strong>{genderText(participant.gender)} {participant.seatNo}</strong></td>
            <td>{participant.latestSubmission ? "제출" : "미제출"}</td>
            <td>{participant.latestSubmission ? <>{participant.latestSubmission.name}<div className="small-text">{participant.latestSubmission.nickname} / {formatPhone(participant.latestSubmission.phone)}</div></> : "-"}</td>
            <td>{participant.latestSubmission ? `${choiceText(dashboard, participant.latestSubmission.firstChoiceId)} / ${choiceText(dashboard, participant.latestSubmission.secondChoiceId)}` : "-"}</td>
            <td>{participant.submissionVersions.map((submission) => <div className="small-text" key={submission.id}>{submissionVersionText(dashboard, submission)}</div>)}</td>
          </tr>
        ))}
      </TablePanel>

      <TablePanel title="연락처 열람 로그" columns={["시각", "본 사람", "조회 대상"]}>
        {selectedLogs.length ? selectedLogs.map((log) => (
          <tr key={log.id}>
            <td>{formatTime(log.viewedAt)}</td>
            <td>{participantSummary(dashboard, log.viewerParticipantId)}</td>
            <td>{participantSummary(dashboard, log.targetParticipantId)}</td>
          </tr>
        )) : <EmptyRow colSpan={3} text="아직 열람 기록이 없습니다." />}
      </TablePanel>

      <section className="panel">
        <div className="section-head inline-head">
          <div>
            <h2>회원 검색</h2>
            <p>전화번호 기준 누적 회원을 검색하고 일반 / 저품질 / 블랙리스트 상태를 관리합니다.</p>
          </div>
          <input className="search-input" placeholder="이름, 닉네임, 전화번호, 메모" value={memberKeyword} onChange={(event) => setMemberKeyword(event.target.value)} />
        </div>
        <MemberTable dashboard={dashboard} keyword={memberKeyword} onSave={(memberId, body) => runAction("회원 정보를 저장했습니다.", () => api(`/api/admin/members/${memberId}`, { method: "POST", body }))} />
      </section>
    </main>
  );
}

function CurrentEventSummary({ event }) {
  return (
    <div className="section-head">
      <h2>현재 모임</h2>
      <p>{event.title} · {event.eventDate} · 남자 {event.maleCapacity}명 / 여자 {event.femaleCapacity}명</p>
    </div>
  );
}

function EventCreator({ onCreate }) {
  const [form, setForm] = useState({
    title: "",
    eventDate: koreaTodayDate(),
    maleCapacity: 5,
    femaleCapacity: 5,
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function createBody() {
    return {
      title: form.title,
      eventDate: form.eventDate || koreaTodayDate(),
      maleCapacity: form.maleCapacity,
      femaleCapacity: form.femaleCapacity,
    };
  }

  return (
    <form className="settings-grid" onSubmit={(submitEvent) => { submitEvent.preventDefault(); onCreate(createBody()); }}>
      <label>행사명<input placeholder="예시) 5월 4주차 부부 매칭" value={form.title} onChange={(event) => update("title", event.target.value)} /></label>
      <label>행사일<input type="date" value={form.eventDate} onChange={(event) => update("eventDate", event.target.value)} /></label>
      <label>남자 번호<input type="number" min="1" value={form.maleCapacity} onChange={(event) => update("maleCapacity", event.target.value)} /></label>
      <label>여자 번호<input type="number" min="1" value={form.femaleCapacity} onChange={(event) => update("femaleCapacity", event.target.value)} /></label>
      <button className="primary-button" type="submit">새 모임 만들기</button>
    </form>
  );
}

function MemberTable({ dashboard, keyword, onSave }) {
  const members = (dashboard.memberSummaries ?? dashboard.members).filter((member) => {
    const haystack = [
      member.name,
      member.nickname,
      member.latestName,
      member.latestNickname,
      ...(member.nameAliases ?? []),
      ...(member.nicknameAliases ?? []),
      member.phone,
      member.status,
      member.memo,
      member.job,
      member.height,
    ].join(" ").toLowerCase();
    return haystack.includes(keyword.trim().toLowerCase());
  });

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>이름</th>
            <th>프로필</th>
            <th>연락처</th>
            <th>상태</th>
            <th>최고순위/참여</th>
            <th>메모</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.length ? members.map((member) => <MemberRow key={member.id} member={member} onSave={onSave} />) : <EmptyRow colSpan={7} text="검색 결과가 없습니다." />}
        </tbody>
      </table>
    </div>
  );
}

function MemberRow({ member, onSave }) {
  const [form, setForm] = useState({
    nickname: member.nickname ?? "",
    mbti: member.mbti ?? "",
    job: member.job ?? "",
    height: member.height ?? "",
    strengths: member.strengths ?? "",
    desiredPartner: member.desiredPartner ?? "",
    status: normalizeMemberStatus(member.status),
    memo: member.memo ?? "",
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <tr>
      <td>
        <strong>{member.name}</strong>
        <div className="small-text">닉네임</div>
        <input value={form.nickname} onChange={(event) => update("nickname", event.target.value)} />
      </td>
      <td>
        <div className="profile-grid">
          <input placeholder="MBTI" value={form.mbti} onChange={(event) => update("mbti", event.target.value)} />
          <input placeholder="직업" value={form.job} onChange={(event) => update("job", event.target.value)} />
          <input placeholder="키" value={form.height} onChange={(event) => update("height", event.target.value)} />
          <input placeholder="장점" value={form.strengths} onChange={(event) => update("strengths", event.target.value)} />
          <input placeholder="이성에게 바라는 점" value={form.desiredPartner} onChange={(event) => update("desiredPartner", event.target.value)} />
        </div>
      </td>
      <td>{formatPhone(member.phone)}<div className="small-text">{genderText(member.gender)}</div></td>
      <td>
        <select value={form.status} onChange={(event) => update("status", event.target.value)}>
          <option value="normal">일반</option>
          <option value="poor_quality">저품질</option>
          <option value="blacklist">블랙리스트</option>
        </select>
      </td>
      <td>
        <strong>{bestRankText(member)}</strong>
        <div className="small-text">참여 {member.confirmedParticipationCount ?? member.participationCount ?? 0}회</div>
        <div className="small-text">호감률 {rateText(member.averagePopularityRate)} / 매칭률 {rateText(member.averageMatchRate ?? member.matchedEventRate)}</div>
      </td>
      <td><input value={form.memo} onChange={(event) => update("memo", event.target.value)} /></td>
      <td><button className="secondary-button" type="button" onClick={() => onSave(member.id, form)}>저장</button></td>
    </tr>
  );
}

function TablePanel({ title, columns, children }) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><b>{value}</b></div>;
}

function EmptyRow({ colSpan, text }) {
  return <tr><td className="empty-state" colSpan={colSpan}>{text}</td></tr>;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "요청에 실패했습니다.");
  return payload;
}

function resolveRunId(dashboard, previous) {
  const ids = new Set(dashboard.calculationRuns.map((run) => run.id));
  if (previous && ids.has(previous)) return previous;
  return dashboard.event.releasedCalculationRunId ?? dashboard.latestRun?.id ?? dashboard.calculationRuns.at(-1)?.id ?? "";
}

function participantById(dashboard, participantId) {
  return dashboard.participants.find((participant) => participant.id === participantId);
}

function participantSummary(dashboard, participantId) {
  const participant = participantById(dashboard, participantId);
  if (!participant) return participantId;
  return `${genderText(participant.gender)} ${participant.seatNo} / ${participant.latestSubmission?.name ?? "-"}`;
}

function choiceText(dashboard, participantId) {
  if (!participantId || participantId === "none") return "없음";
  const participant = participantById(dashboard, participantId);
  return participant ? `${genderText(participant.gender)} ${participant.seatNo}` : participantId;
}

function submissionVersionText(dashboard, submission) {
  return [
    `v${submission.version}`,
    `1순위 ${choiceText(dashboard, submission.firstChoiceId)}`,
    `2순위 ${choiceText(dashboard, submission.secondChoiceId)}`,
    submission.reviewNote ? `선택 ${submission.reviewNote}` : "",
    submission.comment ? `의견 ${submission.comment}` : "",
  ].filter(Boolean).join(" / ");
}

function compareStat(a, b) {
  if (a.gender !== b.gender) return a.gender === "male" ? -1 : 1;
  const rankA = a.genderRank ?? Number.POSITIVE_INFINITY;
  const rankB = b.genderRank ?? Number.POSITIVE_INFINITY;
  if (rankA !== rankB) return rankA - rankB;
  return b.score - a.score;
}

function runTitle(run) {
  return `계산 ${run.runNo}`;
}

function matchCodeText(code) {
  return String(code ?? "").replace("M", "남자 ").replace("-F", "순위 / 여자 ").concat("순위");
}

function statusText(status) {
  return ({
    ready: "준비",
    voting: "투표 중",
    closed: "마감",
    released: "공개",
    ended: "종료",
    draft: "초안",
  })[status] ?? status ?? "-";
}

function genderText(gender) {
  return gender === "male" ? "남자" : "여자";
}

function formatPhone(phone) {
  const value = String(phone ?? "");
  if (value.length === 11) return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
  return value;
}

function formatTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function normalizeMemberStatus(status) {
  if (status === "inactive") return "normal";
  if (status === "do_not_invite") return "blacklist";
  if (["normal", "poor_quality", "blacklist"].includes(status)) return status;
  return "normal";
}

function bestRankText(member) {
  if (member.bestRank === null || member.bestRank === undefined) return "득표 없음";
  if (member.bestRankDenominator) return `최고 ${member.bestRank}위 (${member.bestRankDenominator}명 기준)`;
  return `최고 ${member.bestRank}위`;
}

function koreaTodayDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function rateText(value) {
  if (value === null || value === undefined) return "-";
  return `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
}
