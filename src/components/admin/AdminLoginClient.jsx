"use client";

import { useState } from "react";

export default function AdminLoginClient() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function login(event) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error === "invalid_admin_password" ? "비밀번호가 맞지 않습니다." : "로그인에 실패했습니다.");
      return;
    }
    window.location.href = payload.adminPath;
  }

  return (
    <main className="login-shell">
      <section className="panel login-panel">
        <p className="eyebrow">Buboo Operations</p>
        <h1>운영자 로그인</h1>
        <form className="form-grid" onSubmit={login}>
          <label className="wide">
            비밀번호
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
          </label>
          <div className="form-actions wide">
            <button className="primary-button" type="submit">로그인</button>
          </div>
        </form>
        {message ? <p className="inline-message">{message}</p> : null}
      </section>
    </main>
  );
}
