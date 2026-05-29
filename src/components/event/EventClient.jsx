"use client";

import { useEffect, useMemo, useState } from "react";
import { participantScreenState } from "@/domain/participantScreen.js";

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

export default function EventClient({ slug, initialEventData = null }) {
  const [eventData, setEventData] = useState(initialEventData);
  const [vote, setVote] = useState(emptyVote);
  const [resultAuth, setResultAuth] = useState({ name: "", phone: "" });
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(!initialEventData);
  const [lastAuth, setLastAuth] = useState(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [isLookingUpResult, setIsLookingUpResult] = useState(false);
  const [revealingMatchId, setRevealingMatchId] = useState("");

  useEffect(() => {
    if (initialEventData?.publicSlug === slug) {
      setEventData(initialEventData);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
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
  }, [slug, initialEventData]);

  const ownCapacity = vote.gender === "male" ? eventData?.maleCapacity : eventData?.femaleCapacity;
  const targetCapacity = vote.gender === "male" ? eventData?.femaleCapacity : eventData?.maleCapacity;
  const targetGenderText = vote.gender === "male" ? "여성" : vote.gender === "female" ? "남성" : "이성";
  const targetSeatText = vote.gender === "male" ? "여자" : vote.gender === "female" ? "남자" : "이성";
  const screenState = participantScreenState(eventData?.status);
  const canVote = screenState === "vote";
  const isPreparingResult = screenState === "preparing";
  const canCheckResult = screenState === "result";
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
    if (isSubmittingVote) return;
    setMessage("");
    setIsSubmittingVote(true);
    try {
      const response = await api(`/api/events/${slug}/submissions`, {
        method: "POST",
        body: vote,
      });
      const auth = { name: vote.name, phone: vote.phone };
      setLastAuth(auth);
      setResultAuth(auth);
      setMessage(`제출이 완료되었어요. v${response.submission.version}로 저장되었습니다. 마감 전 다시 제출하면 최신 제출만 최종 반영됩니다.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmittingVote(false);
    }
  }

  async function lookupResult(event) {
    event.preventDefault();
    if (isLookingUpResult) return;
    setMessage("");
    setResult(null);
    setIsLookingUpResult(true);
    try {
      const payload = await api(`/api/events/${slug}/result`, {
        method: "POST",
        body: resultAuth,
      });
      setLastAuth(resultAuth);
      setResult(payload);
    } catch (error) {
      setResult({ status: "error", message: error.message });
    } finally {
      setIsLookingUpResult(false);
    }
  }

  async function revealContact(match) {
    if (!lastAuth || revealingMatchId) return;
    setMessage("");
    setRevealingMatchId(match.id);
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
    } finally {
      setRevealingMatchId("");
    }
  }

  if (loading) {
    return (
      <main className="event-shell">
        <div className="loading-state" role="status" aria-label="로딩 중">
          <span className="loading-spinner" />
        </div>
      </main>
    );
  }

  return (
    <main className="event-shell">
      <header className="event-header">
        <p className="eyebrow">부부, 호기심에서 결혼까지</p>
        <h1>{eventData?.displayTitle ?? eventData?.title ?? "매칭 투표"}</h1>
        <span className="status-pill">{statusText(eventData?.status)}</span>
      </header>

      {message ? <p className="inline-message">{message}</p> : null}

      {canVote ? (
        <section className="panel vote-panel">
          <div className="section-head">
            <h2>호감도 투표</h2>
            <p>오늘 가장 마음이 갔던 이성을 선택해 주세요.</p>
            <div className="notice-block">
              모임 플랫폼 앱에 후기를 남겨주신 분들께는 확인 후 커피 쿠폰을 준비해드릴 예정입니다.
            </div>
          </div>

          <form className="form-grid vote-form" onSubmit={submitVote}>
            <label className="form-question">
              <span className="question-text">성별</span>
              <select required value={vote.gender} onChange={(event) => updateVote("gender", event.target.value)}>
                <option value="">선택</option>
                <option value="male">남자</option>
                <option value="female">여자</option>
              </select>
            </label>

            <label className="form-question">
              <span className="question-text">본인 번호를 선택해주세요</span>
              <select required disabled={!vote.gender} value={vote.seatNo} onChange={(event) => updateVote("seatNo", event.target.value)}>
                <option value="">선택</option>
                {seatOptions(ownCapacity).map((seat) => <option key={seat} value={seat}>{seat}번</option>)}
              </select>
            </label>

            <label className="form-question">
              <span className="question-text">이름</span>
              <input required autoComplete="name" placeholder="예시) 김하늘" value={vote.name} onChange={(event) => updateVote("name", event.target.value)} />
            </label>

            <label className="form-question">
              <span className="question-text">연락처</span>
              <input required inputMode="tel" autoComplete="tel" placeholder="예시) 01011223344" value={vote.phone} onChange={(event) => updateVote("phone", event.target.value)} />
            </label>

            <label className="form-question">
              <span className="question-text">들어오시며 말씀주신 닉네임</span>
              <input required placeholder="예시) 제이" value={vote.nickname} onChange={(event) => updateVote("nickname", event.target.value)} />
            </label>

            <label className="form-question">
              <span className="question-text">오늘의 1순위 {targetGenderText}분은 누구였나요? ({targetSeatText} __번)</span>
              <select required disabled={!vote.gender} value={vote.firstChoiceSeatNo} onChange={(event) => updateVote("firstChoiceSeatNo", event.target.value)}>
                <option value="">선택</option>
                {targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="form-question">
              <span className="question-text">오늘의 2순위 {targetGenderText}분은 누구였나요? ({targetSeatText} __번)</span>
              <select required disabled={!vote.gender || vote.firstChoiceSeatNo === "none"} value={vote.secondChoiceSeatNo} onChange={(event) => updateVote("secondChoiceSeatNo", event.target.value)}>
                <option value="">선택</option>
                {targetOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={vote.firstChoiceSeatNo && vote.firstChoiceSeatNo !== "none" && vote.firstChoiceSeatNo === option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-question wide">
              <span className="question-text">[선택] 부부에게 하고 싶은 말</span>
              <textarea rows={4} placeholder="좋거나 불편하셨던 사항을 알려주세요." value={vote.comment} onChange={(event) => updateVote("comment", event.target.value)} />
            </label>

            <div className="form-actions wide vote-submit-row">
              <button className="primary-button" type="submit" disabled={isSubmittingVote}>
                {isSubmittingVote ? "제출 중..." : "제출하기"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {isPreparingResult ? (
        <section className="panel preparing-panel">
          <div className="section-head">
            <h2>결과 정리 중</h2>
            <p>투표가 마감되어 결과를 정리하고 있습니다. 잠시 후 다시 확인해 주세요.</p>
          </div>
        </section>
      ) : null}

      {canCheckResult ? (
        <section className="panel">
          <div className="section-head">
            <h2>이름과 연락처로 결과를 확인해 주세요.</h2>
            <p>연락처는 전체 번호 또는 뒤 4자리로 확인할 수 있어요.</p>
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
              <button className="secondary-button" type="submit" disabled={isLookingUpResult}>
                {isLookingUpResult ? "확인 중..." : "결과 보기"}
              </button>
            </div>
          </form>
          <ResultView result={result} onReveal={revealContact} revealingMatchId={revealingMatchId} />
        </section>
      ) : null}
    </main>
  );
}

function ResultView({ result, onReveal, revealingMatchId }) {
  if (!result) return null;
  if (result.status === "error") return <p className="empty-state">{result.message}</p>;
  if (result.status === "pending") {
    return (
      <div className="result-box">
        아직 결과를 정리하고 있습니다. 잠시 후 다시 확인해 주세요.
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
        <p>아쉽게도 이번에는 서로의 마음이 닿지 않았어요.</p>
        <p>귀한 시간 내어 부부와 함께해 주셔서 진심으로 감사드려요.</p>
        <p>앞으로 다가올 소중한 인연을 늘 응원할게요.</p>
      </div>
    );
  }

  return (
    <div className="result-list">
      {result.matches.map((match) => (
        <article className="result-box" key={match.id}>
          <h3>두 분의 마음이 닿았어요. ❤</h3>
          <p>서로를 향한 따뜻한 호감이 확인되어 매칭되었어요.</p>
          <p>{genderText(match.target.gender)} {match.target.seatNo}번</p>
          <p className="contact-expiry-note">연락처는 오늘까지만 확인할 수 있어요. 잊지 않도록 지금 저장해 주세요.</p>
          {match.revealedPhone ? (
            <p className="contact-value">{formatPhone(match.revealedPhone)}</p>
          ) : (
            <button className="secondary-button" type="button" disabled={revealingMatchId === match.id} onClick={() => onReveal(match)}>
              {revealingMatchId === match.id ? "연락처 확인 중..." : "연락처 보기"}
            </button>
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
    closed: "결과 정리 중",
    released: "결과 확인",
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
    participant_auth_failed: "입력해 주신 정보와 일치하는 결과를 찾지 못했어요. 정보가 정확한지 다시 한번 확인해 주세요.",
    participant_auth_ambiguous: "동명이인 또는 연락처 뒤 4자리 중복 가능성이 있어 전체 연락처로 다시 확인해 주세요.",
    phone_required: "연락처를 입력해 주세요.",
    name_required: "이름을 입력해 주세요.",
    nickname_required: "닉네임을 입력해 주세요.",
    event_not_accepting_votes: "현재 투표를 받을 수 없는 상태입니다.",
    result_expired: "결과와 연락처는 행사 당일까지만 확인할 수 있습니다.",
  })[code] ?? code ?? "요청에 실패했습니다.";
}
