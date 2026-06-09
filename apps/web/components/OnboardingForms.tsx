'use client';

import { useState } from 'react';

interface School {
  id: string;
  name: string;
}

type Body = Record<string, string>;

function useCreate(path: 'teachers' | 'students' | 'parents') {
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(body: Body): Promise<void> {
    setBusy(true);
    setMsg('');
    const res = await fetch(`/api/admin/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      message?: string;
      error?: string;
    };
    setBusy(false);
    setOk(res.ok);
    setMsg(
      res.ok
        ? `Created ${json.name} (${json.id})`
        : `Error: ${json.message ?? json.error ?? `HTTP ${res.status}`}`,
    );
  }

  return { msg, ok, busy, submit };
}

function SchoolSelect({ schools, value, onChange }: { schools: School[]; value: string; onChange: (v: string) => void }) {
  return (
    <>
      <label>School</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {schools.length === 0 && <option value="">(no schools)</option>}
        {schools.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </>
  );
}

function TeacherForm({ schools }: { schools: School[] }) {
  const [givenName, setGiven] = useState('');
  const [familyName, setFamily] = useState('');
  const [schoolOrgId, setSchool] = useState(schools[0]?.id ?? '');
  const { msg, ok, busy, submit } = useCreate('teachers');
  return (
    <form
      className="onboard-card"
      onSubmit={(e) => {
        e.preventDefault();
        void submit({ givenName, familyName, schoolOrgId });
      }}
    >
      <h2>Add teacher</h2>
      <label>First name</label>
      <input value={givenName} onChange={(e) => setGiven(e.target.value)} required />
      <label>Last name</label>
      <input value={familyName} onChange={(e) => setFamily(e.target.value)} required />
      <SchoolSelect schools={schools} value={schoolOrgId} onChange={setSchool} />
      <button type="submit" disabled={busy}>
        {busy ? 'Adding…' : 'Add teacher'}
      </button>
      {msg && <p className={ok ? 'form-ok' : 'form-err'}>{msg}</p>}
    </form>
  );
}

function StudentForm({ schools }: { schools: School[] }) {
  const [givenName, setGiven] = useState('');
  const [familyName, setFamily] = useState('');
  const [grade, setGrade] = useState('K');
  const [schoolOrgId, setSchool] = useState(schools[0]?.id ?? '');
  const { msg, ok, busy, submit } = useCreate('students');
  return (
    <form
      className="onboard-card"
      onSubmit={(e) => {
        e.preventDefault();
        void submit({ givenName, familyName, grade, schoolOrgId });
      }}
    >
      <h2>Add student</h2>
      <label>First name</label>
      <input value={givenName} onChange={(e) => setGiven(e.target.value)} required />
      <label>Last name</label>
      <input value={familyName} onChange={(e) => setFamily(e.target.value)} required />
      <label>Grade</label>
      <input value={grade} onChange={(e) => setGrade(e.target.value)} required />
      <SchoolSelect schools={schools} value={schoolOrgId} onChange={setSchool} />
      <button type="submit" disabled={busy}>
        {busy ? 'Adding…' : 'Add student'}
      </button>
      {msg && <p className={ok ? 'form-ok' : 'form-err'}>{msg}</p>}
    </form>
  );
}

function ParentForm() {
  const [givenName, setGiven] = useState('');
  const [familyName, setFamily] = useState('');
  const [studentId, setStudentId] = useState('');
  const { msg, ok, busy, submit } = useCreate('parents');
  return (
    <form
      className="onboard-card"
      onSubmit={(e) => {
        e.preventDefault();
        void submit({ givenName, familyName, studentId });
      }}
    >
      <h2>Add parent / guardian</h2>
      <label>First name</label>
      <input value={givenName} onChange={(e) => setGiven(e.target.value)} required />
      <label>Last name</label>
      <input value={familyName} onChange={(e) => setFamily(e.target.value)} required />
      <label>Student ID</label>
      <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="e.g. S00001" required />
      <button type="submit" disabled={busy}>
        {busy ? 'Linking…' : 'Add parent'}
      </button>
      {msg && <p className={ok ? 'form-ok' : 'form-err'}>{msg}</p>}
    </form>
  );
}

export function OnboardingForms({ schools }: { schools: School[] }) {
  return (
    <div className="onboard-grid">
      <TeacherForm schools={schools} />
      <StudentForm schools={schools} />
      <ParentForm />
    </div>
  );
}
