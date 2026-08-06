"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import type { RoadAlert, RoadQuestion, RoadQuestionReply, CountryCode, Profile } from "@/lib/types";
import { Loader2, AlertTriangle, Plus, MapPin, X, CheckCircle2, MessageCircleQuestion, ClipboardCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function DriversForumPage() {
  const supabase = createClient();
  const modal = useModal();
  const [tab, setTab] = useState<"alerts" | "questions">("alerts");
  const [alerts, setAlerts] = useState<(RoadAlert & { driverName?: string })[]>([]);
  const [questions, setQuestions] = useState<(RoadQuestion & { driverName?: string })[]>([]);
  const [repliesByQuestion, setRepliesByQuestion] = useState<Record<string, (RoadQuestionReply & { driverName?: string })[]>>({});
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState<CountryCode>("ZA");
  const [userId, setUserId] = useState<string | null>(null);

  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertRoadName, setAlertRoadName] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [clearingId, setClearingId] = useState<string | null>(null);

  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [qRoadName, setQRoadName] = useState("");
  const [qText, setQText] = useState("");
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loggingReplyId, setLoggingReplyId] = useState<string | null>(null);

  async function loadNames(ids: string[]) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids.length ? ids : ["-"]);
    return (data as Profile[]) || [];
  }

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase.from("profiles").select("country").eq("id", user.id).single();
    const c = (profile?.country as CountryCode) || "ZA";
    setCountry(c);
    const todayIso = startOfToday().toISOString();

    // Alerts — same-day only, cleared ones excluded.
    const { data: alertData } = await supabase
      .from("road_alerts")
      .select("*")
      .eq("country", c)
      .gte("created_at", todayIso)
      .is("cleared_at", null)
      .order("created_at", { ascending: false });
    const alertsList = (alertData as RoadAlert[]) || [];
    const alertNames = await loadNames([...new Set(alertsList.map((a) => a.driver_id))]);
    setAlerts(alertsList.map((a) => ({ ...a, driverName: alertNames.find((p) => p.id === a.driver_id)?.full_name })));

    // Questions — same-day only.
    const { data: qData } = await supabase
      .from("road_questions")
      .select("*")
      .eq("country", c)
      .gte("created_at", todayIso)
      .order("created_at", { ascending: false });
    const qList = (qData as RoadQuestion[]) || [];
    const qNames = await loadNames([...new Set(qList.map((q) => q.driver_id))]);
    setQuestions(qList.map((q) => ({ ...q, driverName: qNames.find((p) => p.id === q.driver_id)?.full_name })));

    // Replies for all of today's questions.
    if (qList.length) {
      const { data: replyData } = await supabase
        .from("road_question_replies")
        .select("*")
        .in("question_id", qList.map((q) => q.id))
        .order("created_at", { ascending: true });
      const replyList = (replyData as RoadQuestionReply[]) || [];
      const replyNames = await loadNames([...new Set(replyList.map((r) => r.driver_id))]);
      const grouped: Record<string, (RoadQuestionReply & { driverName?: string })[]> = {};
      replyList.forEach((r) => {
        const withName = { ...r, driverName: replyNames.find((p) => p.id === r.driver_id)?.full_name };
        grouped[r.question_id] = [...(grouped[r.question_id] || []), withName];
      });
      setRepliesByQuestion(grouped);
    } else {
      setRepliesByQuestion({});
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("drivers-forum")
      .on("postgres_changes", { event: "*", schema: "public", table: "road_alerts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "road_questions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "road_question_replies" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function geocodeNear(query: string) {
    const { data: myProfile } = await supabase
      .from("driver_profiles")
      .select("current_lat, current_lng")
      .eq("user_id", userId)
      .single();
    const biasParam =
      myProfile?.current_lat && myProfile?.current_lng ? `&biasLat=${myProfile.current_lat}&biasLng=${myProfile.current_lng}` : "";
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&countrycodes=${country.toLowerCase()}${biasParam}`);
    const data = await res.json();
    return data.results?.[0] || null;
  }

  async function postAlert() {
    if (!alertRoadName.trim() || !alertMessage.trim() || !userId) return;
    setPosting(true);
    const match = await geocodeNear(alertRoadName);
    if (!match) {
      setPosting(false);
      await modal.alert("Couldn't find that location — try a more specific road or landmark name.");
      return;
    }
    const { error } = await supabase.from("road_alerts").insert({
      driver_id: userId,
      country,
      road_name: alertRoadName.trim(),
      message: alertMessage.trim(),
      lat: match.lat,
      lng: match.lng,
    });
    setPosting(false);
    if (error) {
      await modal.alert(`Could not post alert: ${error.message}`);
      return;
    }
    setAlertRoadName("");
    setAlertMessage("");
    setShowAlertForm(false);
    await load();
  }

  async function clearAlert(id: string) {
    const ok = await modal.confirm("Mark this alert as resolved? It'll stop showing to other drivers.", {
      confirmLabel: "Clear it",
    });
    if (!ok) return;
    setClearingId(id);
    const res = await fetch(`/api/road-alerts/${id}/clear`, { method: "POST" });
    setClearingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not clear: ${data.error || "Unknown error"}`);
      return;
    }
    await load();
  }

  async function askQuestion() {
    if (!qRoadName.trim() || !qText.trim() || !userId) return;
    setAskingQuestion(true);
    const { error } = await supabase.from("road_questions").insert({
      driver_id: userId,
      country,
      road_name: qRoadName.trim(),
      question: qText.trim(),
    });
    setAskingQuestion(false);
    if (error) {
      await modal.alert(`Could not post question: ${error.message}`);
      return;
    }
    setQRoadName("");
    setQText("");
    setShowQuestionForm(false);
    await load();
  }

  async function postReply(questionId: string) {
    const text = replyDrafts[questionId]?.trim();
    if (!text || !userId) return;
    setReplyingTo(questionId);
    const { error } = await supabase.from("road_question_replies").insert({
      question_id: questionId,
      driver_id: userId,
      reply: text,
    });
    setReplyingTo(null);
    if (error) {
      await modal.alert(`Could not post reply: ${error.message}`);
      return;
    }
    setReplyDrafts((prev) => ({ ...prev, [questionId]: "" }));
    await load();
  }

  async function logReplyAsAlert(reply: RoadQuestionReply, question: RoadQuestion) {
    setLoggingReplyId(reply.id);
    // Road reference defaults to the question's own road unless the driver
    // typed a different one directly in their reply — a lightweight
    // heuristic: if the reply text already mentions the question's road
    // name, keep it; otherwise still default to the question's road, since
    // asking a driver to separately re-specify it for every reply would be
    // needless friction on top of an already-quick "log it" action.
    const match = await geocodeNear(question.road_name);
    if (!match) {
      setLoggingReplyId(null);
      await modal.alert("Couldn't resolve that location — try posting this as a regular alert instead.");
      return;
    }

    const { data: inserted, error } = await supabase
      .from("road_alerts")
      .insert({
        driver_id: reply.driver_id,
        country,
        road_name: question.road_name,
        message: reply.reply,
        lat: match.lat,
        lng: match.lng,
      })
      .select()
      .single();

    if (error || !inserted) {
      setLoggingReplyId(null);
      await modal.alert(`Could not log this as an alert: ${error?.message || "Unknown error"}`);
      return;
    }

    await supabase.from("road_question_replies").update({ logged_as_alert_id: inserted.id }).eq("id", reply.id);
    setLoggingReplyId(null);
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Drivers Forum</h1>
        <p className="text-navy-400 text-sm mt-1">Shared today only — road conditions and quick questions from drivers near you.</p>
      </div>

      <div className="flex gap-2 border-b border-navy-100">
        <button
          className={`px-3 py-2 text-sm font-semibold border-b-2 ${tab === "alerts" ? "border-gold-400 text-navy-800" : "border-transparent text-navy-400"}`}
          onClick={() => setTab("alerts")}
        >
          Alerts
        </button>
        <button
          className={`px-3 py-2 text-sm font-semibold border-b-2 ${tab === "questions" ? "border-gold-400 text-navy-800" : "border-transparent text-navy-400"}`}
          onClick={() => setTab("questions")}
        >
          Ask a Question
        </button>
      </div>

      {tab === "alerts" && (
        <>
          <div className="flex justify-end">
            <button className="btn-primary !py-2 !px-3" onClick={() => setShowAlertForm((v) => !v)}>
              {showAlertForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Report
            </button>
          </div>

          {showAlertForm && (
            <div className="card p-5 space-y-3">
              <div>
                <label className="label block mb-1">Road or landmark</label>
                <input className="input" placeholder="e.g. Chiremba Road" value={alertRoadName} onChange={(e) => setAlertRoadName(e.target.value)} />
              </div>
              <div>
                <label className="label block mb-1">What's happening</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. Broken-down haulage truck blocking one lane"
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                />
              </div>
              <button className="btn-primary w-full" disabled={posting || !alertRoadName.trim() || !alertMessage.trim()} onClick={postAlert}>
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} Post alert
              </button>
              <p className="text-xs text-navy-400">Visible to drivers today only — clears automatically tomorrow.</p>
            </div>
          )}

          {!alerts.length && !showAlertForm && (
            <div className="card p-6 text-center text-navy-400 text-sm">
              No road alerts today — tap Report if you see something worth flagging.
            </div>
          )}

          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.id} className="card p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-gold-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-navy-400 shrink-0" /> {a.road_name}
                    </p>
                    <p className="text-sm text-navy-600 mt-1">{a.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-navy-400">
                        {a.driverName || "A driver"} &middot; {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                      <button
                        className="text-xs font-semibold text-jade-600 flex items-center gap-1"
                        disabled={clearingId === a.id}
                        onClick={() => clearAlert(a.id)}
                      >
                        {clearingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "questions" && (
        <>
          <div className="flex justify-end">
            <button className="btn-primary !py-2 !px-3" onClick={() => setShowQuestionForm((v) => !v)}>
              {showQuestionForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Ask
            </button>
          </div>

          {showQuestionForm && (
            <div className="card p-5 space-y-3">
              <div>
                <label className="label block mb-1">Road or area</label>
                <input className="input" placeholder="e.g. Seke Road" value={qRoadName} onChange={(e) => setQRoadName(e.target.value)} />
              </div>
              <div>
                <label className="label block mb-1">Your question</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. Is it congested right now?"
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                />
              </div>
              <button className="btn-primary w-full" disabled={askingQuestion || !qRoadName.trim() || !qText.trim()} onClick={askQuestion}>
                {askingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircleQuestion className="w-4 h-4" />} Post question
              </button>
            </div>
          )}

          {!questions.length && !showQuestionForm && (
            <div className="card p-6 text-center text-navy-400 text-sm">
              No questions today — tap Ask if you want to check on a route before heading that way.
            </div>
          )}

          <div className="space-y-3">
            {questions.map((q) => {
              const replies = repliesByQuestion[q.id] || [];
              return (
                <div key={q.id} className="card p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-navy-400 shrink-0" /> {q.road_name}
                    </p>
                    <p className="text-sm text-navy-600 mt-1">{q.question}</p>
                    <p className="text-xs text-navy-400 mt-1">
                      {q.driverName || "A driver"} &middot; {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  {replies.length > 0 && (
                    <div className="space-y-2 border-t border-navy-50 pt-3">
                      {replies.map((r) => (
                        <div key={r.id} className="bg-navy-50 rounded-lg px-3 py-2">
                          <p className="text-sm text-navy-700">{r.reply}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-xs text-navy-400">
                              {r.driverName || "A driver"} &middot; {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                            </p>
                            {r.driver_id === userId &&
                              (r.logged_as_alert_id ? (
                                <span className="text-xs text-jade-600 flex items-center gap-1">
                                  <ClipboardCheck className="w-3.5 h-3.5" /> Logged
                                </span>
                              ) : (
                                <button
                                  className="text-xs font-semibold text-gold-600 flex items-center gap-1"
                                  disabled={loggingReplyId === r.id}
                                  onClick={() => logReplyAsAlert(r, q)}
                                >
                                  {loggingReplyId === r.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <ClipboardCheck className="w-3.5 h-3.5" />
                                  )}
                                  Log it
                                </button>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      className="input !py-2 flex-1"
                      placeholder="Reply with what you're seeing…"
                      value={replyDrafts[q.id] || ""}
                      onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    />
                    <button
                      className="btn-ghost !py-2 !px-3 shrink-0"
                      disabled={replyingTo === q.id || !replyDrafts[q.id]?.trim()}
                      onClick={() => postReply(q.id)}
                    >
                      {replyingTo === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reply"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
