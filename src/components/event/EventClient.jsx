"use client";

import { useEffect, useMemo, useState } from "react";

const emptyVote = {
  gender: "",
  seatNo: "",
  name: "",
  phone: "",
  nickname: "",
  firstChoiceSeatNo: "",
  secondChoiceSeatNo: "",
  comment: "",
};

export default function EventClient({ slug }) {
  const [eventData, setEventData] = useState(null);
  const [vote, setVote] = useState(emptyVote);
  const [resultAuth, setResultAuth] = useState({ name: "", phone: "" });
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastAuth, setLastAuth] = useState(null);

  useEffect(() => {
    let active = true;
    api(`/api/events/${slug}/public`)
      .then((payload) => {
        if (active) setEventData(payload);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const ownCapacity = vote.gender === "male" ? eventData?.maleCapacity : eventData?.femaleCapacity;
  const targetCapacity = vote.gender === "male" ? eventData?.femaleCapacity : eventData?.maleCapacity;
  const targetGenderText = vote.gender === "male" ? "여성" : vote.gender === "female" ? "남성" : "이성";
  const targetSeatText = vote.gender === "male" ? "여자" : vote.gender === "female" ? "남자" : "이성";
  const canVote = ["ready", "voting"].includes(eventData?.status);
  const targetOptions = useMemo(() => seatOptions(targetCapacity, true), [targetCapacity]);

  function updateVote(field, value) {
    setVote((current) => {
      const next = { ...current, [field]: value };
      if (field === "gender") {
        next.seatNo = "";
        next.firstChoiceSeatNo = "";
        next.secondChoiceSeatNo = "";
      }
      if (field === "firstChoiceSeatNo") {
        if (value === "none") next.secondChoiceSeatNo = "none";
        if (next.secondChoiceSeatNo === value) next.secondChoiceSeatNo = "";
      }
      return next;
    });
  }

  async function submitVote(event) {
    event.preventDefault();
    setMessage("");
    try {
      const response = await api(`/api/events/${slug}/submissions`, {
        method: "POST",
        body: vote,
      });
      const auth = { name: vote.name, phone: vote.phone };
      setLastAuth(auth);
      setResultAuth(auth);
      setMessage(`투표가 제출되었습니다. v${response.submission.version}로 저장되었습니다. 마감 전 다시 제출하면 최신 제출만 계산됩니다.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function lookupResult(event) {
    event.preventDefault();
    setMessage("");
    setResult(null);
    try {
      const payload = await api(`/api/events/${slug}/result`, {
        method: "POST",
        body: resultAuth,
      });
      setLastAuth(resultAuth);
      setResult(payload);
    } catch (error) {
      setResult({ status: "error", message: error.message });
    }
  }

  async function revealContact(match) {
    if (!lastAuth) return;
    try {
      const payload = await api(`/api/events/${slug}/contact`, {
        method: "POST",
        body: {
          ...lastAuth,
          matchResultId: match.id,
          targetParticipantId: match.target.participantId,
        },
      });
      setResult((current) => ({
        ...current,
        matches: current.matches.map((item) => (
          item.id === match.id ? { ...item, revealedPhone: payload.target.phone } : item
        )),
      }));
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (loading) return <main className="event-shell"><p className="empty-state">불러오는 중입니다.</p></main>;

  return (
    <main className="event-shell">
      <header className="event-header">
        <p className="eyebrow">부부, 호기심에서 결혼까지</p>
        <h1>{eventData?.displayTitle ?? eventData?.title ?? "매칭 투표"}</h1>
        <span className="status-pill">{statusText(eventData?.status)}</span>
      </header>

      {message ? <p className="inline-message">{message}</p> : null}

      {canVote ? (
        <section className="panel">
          <div className="section-head">
            <h2>호감도 투표</h2>
            <p>오늘 가장 마음이 갔던 이성을 선택해 주세요.</p>
            <div className="notice-block">
              모임 플랫폼 앱에 후기를 남겨주신 분들께는 확인 후 커피 쿠폰을 준비해드릴 예정입니다.
            </div>
          </div>

          <form className="form-grid" onSubmit={submitVote}>
            <label>
              성별
              <select required value={vote.gender} onChange={(event) => updateVote("gender", event.target.value)}>
                <option value="">선택</option>
                <option value="male">남자</option>
                <option value="female">여자</option>
              </select>
            </label>

            <label>
              본인 번호를 선택해주세요
              <select required disabled={!vote.gender} value={vote.seatNo} onChange={(event) => updateVote("seatNo", event.target.value)}>
                <option value="">선택</option>
                {seatOptions(ownCapacity).map((seat) => <option key={seat} value={seat}>{seat}번</option>)}
              </select>
            </label>

            <label>
              이름
              <input required autoComplete="name" placeholder="예시) 김하늘" value={vote.name} onChange={(event) => updateVote("name", event.target.value)} />
            </label>

            <label>
              연락처
              <input required inputMode="tel" autoComplete="tel" placeholder="예시) 01011223344" value={vote.phone} onChange={(event) => updateVote("phone", event.target.value)} />
            </label>

            <label>
              들어오시며 말씀주신 닉네임
              <input required placeholder="예시) 제이" value={vote.nickname} onChange={(event) => updateVote("nickname", event.target.value)} />
            </label>

            <label>
              오늘의 1순위 {targetGenderText}분은 누구였나요? ({targetSeatText} __번)
              <select required disabled={!vote.gender} value={vote.firstChoiceSeatNo} onChange={(event) => updateVote("firstChoiceSeatNo", event.target.value)}>
                <option value="">선택</option>
                {targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label>
              오늘의 2순위 {targetGenderText}분은 누구였나요? ({targetSeatText} __번)
              <select required disabled={!vote.gender || vote.firstChoiceSeatNo === "none"} value={vote.secondChoiceSeatNo} onChange={(event) => updateVote("secondChoiceSeatNo", event.target.value)}>
                <option value="">선택</option>
                {targetOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={vote.firstChoiceSeatNo && vote.firstChoiceSeatNo !== "none" && vote.firstChoiceSeatNo === option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="wide">
              [선택] 부부에게 하고 싶은 말
              <textarea rows={4} placeholder="좋거나 불편하셨던 사항을 알려주세요." value={vote.comment} onChange={(event) => updateVote("comment", event.target.value)} />
            </label>

            <div className="form-actions wide">
              <button className="primary-button" type="submit">제출하기</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-head">
          <h2>결과 확인</h2>
          <p>운영자가 결과를 공개한 뒤 이름과 연락처로 확인할 수 있습니다.</p>
        </div>
        <form className="form-grid compact" onSubmit={lookupResult}>
          <label>
            이름
            <input required autoComplete="name" placeholder="예시) 김하늘" value={resultAuth.name} onChange={(event) => setResultAuth((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            연락처
            <input required inputMode="tel" autoComplete="tel" placeholder="예시) 01011223344 또는 3344" value={resultAuth.phone} onChange={(event) => setResultAuth((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <div className="form-actions">
            <button className="secondary-button" type="submit">결과 보기</button>
          </div>
        </form>
        <ResultView result={result} onReveal={revealContact} />
      </section>
    </main>
  );
}

function ResultView({ result, onReveal }) {
  if (!result) return null;
  if (result.status === "error") return <p className="empty-state">{result.message}</p>;
  if (result.status === "pending") {
    return (
      <div className="result-box">
        아직 결과를 정리하고 있습니다. 운영자가 최종 확인 후 결과를 공개할 예정입니다.
      </div>
    );
  }
  if (result.status === "expired") {
    return (
      <div className="result-box">
        result_expired: 결과 확인 기간이 종료되었습니다. 결과와 연락처는 행사 당일까지만 확인할 수 있습니다.
      </div>
    );
  }
  if (!result.matches?.length) {
    return (
      <div className="result-box">
        오늘은 서로 연결된 호감이 확인되지 않았어요. 참여해 주셔서 감사합니다.
      </div>
    );
  }

  return (
    <div className="result-list">
      {result.matches.map((match) => (
        <article className="result-box" key={match.id}>
          <h3>매칭되었습니다</h3>
          <p>{genderText(match.target.gender)} {match.target.seatNo}번 {match.target.name} {match.target.nickname ? `(${match.target.nickname})` : ""}</p>
          {match.revealedPhone ? (
            <p className="contact-value">{formatPhone(match.revealedPhone)}</p>
          ) : (
            <button className="secondary-button" type="button" onClick={() => onReveal(match)}>연락처 보기</button>
          )}
        </article>
      ))}
    </div>
  );
}

function seatOptions(capacity, includeNone = false) {
  const count = Number(capacity ?? 0);
  const options = [];
  if (includeNone) options.push({ value: "none", label: "없음" });
  for (let index = 1; index <= count; index += 1) {
    options.push(includeNone ? { value: String(index), label: `${index}번` } : String(index));
  }
  return options;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(errorText(payload.error));
  return payload;
}

function statusText(status) {
  return ({
    ready: "준비",
    voting: "투표 중",
    closed: "마감",
    released: "결과 공개",
    ended: "종료",
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

function errorText(code) {
  return ({
    participant_auth_failed: "입력하신 정보로 제출 내역을 찾지 못했습니다. 이름과 연락처를 다시 확인해 주세요.",
    participant_auth_ambiguous: "동명이인 또는 연락처 뒤 4자리 중복 가능성이 있어 전체 연락처로 다시 확인해 주세요.",
    phone_required: "연락처를 입력해 주세요.",
    name_required: "이름을 입력해 주세요.",
    nickname_required: "닉네임을 입력해 주세요.",
    event_not_accepting_votes: "현재 투표를 받을 수 없는 상태입니다.",
    result_expired: "결과와 연락처는 행사 당일까지만 확인할 수 있습니다.",
  })[code] ?? code ?? "요청에 실패했습니다.";
}
