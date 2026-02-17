import { useState, useEffect, useRef } from "react";

import { supabase } from './supabase'

const WEEK_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

function formatTimeLeft(ms) {
  if (ms <= 0) return "0d 0h 0m";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${days}d ${hours}h ${mins}m`;
}

// Minimal audio player used only for the upload preview
function PreviewPlayer({ src, name }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { document.querySelectorAll("audio").forEach((a) => a.pause()); audio.play().then(() => setPlaying(true)); }
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const fmt = (s) => (!s || isNaN(s)) ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div style={{
      background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)",
      borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 9,
    }}>
      <audio ref={audioRef} src={src} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={toggle} style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: playing ? "#f59e0b" : "transparent",
          border: `2px solid ${playing ? "#f59e0b" : "rgba(245,158,11,0.4)"}`,
          color: playing ? "#1a1208" : "#f59e0b",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, transition: "all 0.2s",
        }}>
          {playing ? "⏸" : "▶"}
        </button>
        <div style={{
          fontFamily: "'Bebas Neue', cursive", fontSize: 15, color: "#fef3c7",
          letterSpacing: 1, flex: 1, minWidth: 0,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {name || "Preview"}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#57534e", fontSize: 10, fontFamily: "monospace", minWidth: 28 }}>{fmt(progress)}</span>
        <div onClick={seek} style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, cursor: "pointer" }}>
          <div style={{
            height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#f59e0b,#ef4444)",
            width: `${duration ? (progress / duration) * 100 : 0}%`, transition: "width 0.1s",
          }} />
        </div>
        <span style={{ color: "#57534e", fontSize: 10, fontFamily: "monospace", minWidth: 28 }}>{fmt(duration)}</span>
      </div>
    </div>
  );
}

// Archive-style track row, used on both This Week (with vote btn) and Archives (static)
function TrackRow({ track, rank, onVote, hasVoted, isCurrentUser }) {
  const isLeading = rank === 0;
  const canVote = onVote && !hasVoted && !isCurrentUser;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {/* Rank bubble */}
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        background: isLeading ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isLeading ? "#f59e0b" : "rgba(255,255,255,0.07)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Bebas Neue', cursive", fontSize: 12,
        color: isLeading ? "#f59e0b" : "#57534e",
      }}>
        {rank + 1}
      </div>

      {/* Card */}
      <div style={{
        flex: 1,
        background: isLeading ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isLeading ? "rgba(245,158,11,0.28)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 10, padding: "13px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: "'Bebas Neue', cursive", fontSize: 17, letterSpacing: 1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {track.trackName}
          </div>
          <div style={{ fontSize: 11, color: "#57534e", marginTop: 2 }}>{track.userName}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* Vote count */}
          <div style={{
            fontFamily: "'Bebas Neue', cursive", fontSize: 14, letterSpacing: 1,
            color: isLeading ? "#f59e0b" : "#57534e",
            minWidth: 36, textAlign: "right",
          }}>
            ♪ {track.votes}
          </div>

          {/* Vote button — only shown on This Week tab */}
          {onVote && (
            <button
              onClick={onVote}
              disabled={!canVote}
              title={isCurrentUser ? "Can't vote for your own track" : hasVoted ? "Already voted this week" : "Vote for this track"}
              style={{
                padding: "6px 16px", borderRadius: 20,
                background: hasVoted
                  ? "transparent"
                  : isCurrentUser
                  ? "transparent"
                  : "rgba(245,158,11,0.9)",
                border: `1px solid ${(hasVoted || isCurrentUser) ? "rgba(255,255,255,0.08)" : "#f59e0b"}`,
                color: canVote ? "#1a1208" : "#3a3530",
                cursor: canVote ? "pointer" : "not-allowed",
                fontFamily: "'Bebas Neue', cursive", fontSize: 13, letterSpacing: 2,
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}
            >
              {hasVoted ? "VOTED" : isCurrentUser ? "YOURS" : "VOTE"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const DEMO_TRACKS = {
  "2026-02-10": [
    { id: "arc1", userId: "user_2", userName: "MoonBeat", trackName: "Neon Reverie", votes: 14 },
    { id: "arc2", userId: "user_3", userName: "CassetteKid", trackName: "Highway Static", votes: 9 },
    { id: "arc3", userId: "user_4", userName: "Driftwood", trackName: "3AM Loops", votes: 22 },
  ],
  "2026-02-03": [
    { id: "arc4", userId: "user_5", userName: "Parallax", trackName: "Signal Lost", votes: 17 },
    { id: "arc6", userId: "user_7", userName: "Velveteen", trackName: "Soft Machinery", votes: 11 },
  ],
};

export default function App() {
  const [tab, setTab] = useState("week");
  const [tracks, setTracks] = useState([]);
  const [userName, setUserName] = useState("");
  const [userNameInput, setUserNameInput] = useState("");
  const [trackName, setTrackName] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [hasUploadedThisWeek, setHasUploadedThisWeek] = useState(false);
  const [votedThisWeek, setVotedThisWeek] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [archiveWeek, setArchiveWeek] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef();

  const currentWeek = getWeekKey();

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const weekEnd = new Date(new Date(currentWeek).getTime() + WEEK_DURATION_MS);
      setTimeLeft(weekEnd - now);
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [currentWeek]);

  useEffect(() => {
    fetchTracks()
  }, [])

  const fetchTracks = async () => {
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .eq('week', currentWeek)
      .order('votes', { ascending: false })

    if (error) {
      console.error('Error fetching tracks:', error)
    } else {
      setTracks(data)
    }
  }

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSetUserName = async (name) => {
    if (!name.trim()) return
    setUserName(name.trim())

    // Check if this user already voted this week
    const { data } = await supabase
      .from('votes')
      .select('id')
      .eq('user_name', name.trim())
      .eq('week', currentWeek)
      .limit(1)

    if (data && data.length > 0) {
      setVotedThisWeek(true)
    }

    // Check if this user already submitted this week
    const { data: trackData } = await supabase
      .from('tracks')
      .select('id')
      .eq('user_name', name.trim())
      .eq('week', currentWeek)
      .limit(1)

    if (trackData && trackData.length > 0) {
      setHasUploadedThisWeek(true)
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) { showToast("Please upload an audio file.", "error"); return; }
    setAudioFile(file);
    setAudioURL(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!userName.trim()) { showToast("Set your display name first.", "error"); return; }
    if (!trackName.trim()) { showToast("Enter a track name.", "error"); return; }
    if (!audioFile) { showToast("Select an audio file.", "error"); return; }

    // Upload the audio file to Supabase Storage
    const fileName = `${currentWeek}_${userName}_${Date.now()}.${audioFile.name.split('.').pop()}`

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, audioFile)

    if (uploadError) {
      showToast("File upload failed. Try again.", "error")
      console.error(uploadError)
      return
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName)

    // Save the track with the audio URL
    const { error } = await supabase
      .from('tracks')
      .insert({
        track_name: trackName,
        user_name: userName,
        week: currentWeek,
        votes: 0,
        audio_url: urlData.publicUrl,
      })

    if (error) {
      showToast("Something went wrong. Try again.", "error")
      return
    }

    setHasUploadedThisWeek(true)
    setTrackName("trackName")
    setAudioFile(null)
    setAudioURL(null)
    showToast("Track submitted! Good luck 🎵")
    fetchTracks()
  };

  const handleVote = async (trackId) => {
    if (votedThisWeek) return

    // Record the vote in the votes table
    const { error: voteError } = await supabase
      .from('votes')
      .insert({
        track_id: trackId,
        user_name: userName,
        week: currentWeek,
      })

    if (voteError) {
      showToast("Something went wrong. Try again.", "error")
      console.error(voteError)
      return
    }

    // Increment the vote count on the track
    const { error: trackError } = await supabase
      .from('tracks')
      .update({ votes: tracks.find(t => t.id === trackId).votes + 1 })
      .eq('id', trackId)

    if (trackError) {
      console.error(trackError)
      return
    }

    setVotedThisWeek(true)
    showToast("Vote cast! ♪")
    fetchTracks()
  };

  const archiveWeeks = Object.keys(DEMO_TRACKS).sort((a, b) => b.localeCompare(a));
  const currentArchive = archiveWeek || archiveWeeks[0];
  const sortedTracks = [...tracks].sort((a, b) => b.votes - a.votes);

  return (
    <div style={{ minHeight: "100vh", background: "#0f0a04", fontFamily: "'Outfit', sans-serif", color: "#fef3c7", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        input::placeholder { color: #44403c; }
        input, button { outline: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1c1208; }
        ::-webkit-scrollbar-thumb { background: #44403c; border-radius: 2px; }
        .tab-btn:hover { color: #f59e0b !important; }
        .upload-zone:hover { border-color: rgba(245,158,11,0.55) !important; background: rgba(245,158,11,0.04) !important; }
        .submit-btn:hover { opacity: 0.85; }
      `}</style>

      {/* Background glows */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 60% at 20% -10%, rgba(245,158,11,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(239,68,68,0.05) 0%, transparent 60%)",
      }} />
      <div style={{
        position: "fixed", top: -120, right: -120, width: 380, height: 380,
        borderRadius: "50%", opacity: 0.035, pointerEvents: "none", zIndex: 0,
        background: "repeating-radial-gradient(circle, #f59e0b 0px, #f59e0b 1px, transparent 1px, transparent 12px)",
      }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 100,
          background: toast.type === "error" ? "#7f1d1d" : "#1c1208",
          border: `1px solid ${toast.type === "error" ? "#ef4444" : "#f59e0b"}`,
          color: toast.type === "error" ? "#fca5a5" : "#fef3c7",
          padding: "11px 18px", borderRadius: 10, fontSize: 13,
          animation: "toastIn 0.3s ease", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <header style={{ padding: "36px 0 24px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 11, letterSpacing: 6, color: "#57534e", marginBottom: 8 }}>
            WEEKLY COMPETITION
          </div>
          <h1 style={{
            fontFamily: "'Bebas Neue', cursive", fontSize: "clamp(48px, 9vw, 82px)",
            lineHeight: 0.9, letterSpacing: 2,
            background: "linear-gradient(135deg, #fef3c7 20%, #f59e0b 60%, #ef4444 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            TRACK<br />BATTLE
          </h1>
          <p style={{ color: "#57534e", marginTop: 12, fontSize: 13, letterSpacing: 1 }}>Upload. Vote. Be remembered.</p>
        </header>

        {/* Countdown + Identity bar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div style={{
            background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)",
            borderRadius: 10, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ color: "#57534e", fontSize: 11, letterSpacing: 1, fontWeight: 500 }}>WEEK ENDS IN</span>
            <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20, color: "#f59e0b", letterSpacing: 2 }}>
              {formatTimeLeft(timeLeft)}
            </span>
          </div>

          {!userName ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={userNameInput}
                onChange={(e) => setUserNameInput(e.target.value)}
                placeholder="Your display name"
                onKeyDown={(e) => { if (e.key === "Enter") handleSetUserName(userNameInput) }}
                style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 8, padding: "9px 14px", color: "#fef3c7",
                  fontFamily: "'Outfit', sans-serif", fontSize: 14, width: 170,
                }}
              />
              <button
                onClick={() => handleSetUserName(userNameInput)}
                style={{
                  background: "#f59e0b", color: "#1a1208", border: "none",
                  borderRadius: 8, padding: "9px 16px", cursor: "pointer",
                  fontFamily: "'Bebas Neue', cursive", fontSize: 14, letterSpacing: 1,
                }}
              >JOIN</button>
            </div>
          ) : (
            <div style={{
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)",
              borderRadius: 8, padding: "9px 14px", fontSize: 13,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ color: "#57534e" }}>Competing as</span>
              <strong style={{ fontFamily: "'Bebas Neue', cursive", letterSpacing: 1, fontSize: 15, color: "#f59e0b" }}>{userName}</strong>
              <button
                onClick={() => { setUserName(""); setHasUploadedThisWeek(false); setVotedThisWeek(false); }}
                style={{ background: "none", border: "none", color: "#44403c", cursor: "pointer", fontSize: 14, padding: 0 }}
              >✕</button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 28 }}>
          {[{ id: "week", label: "THIS WEEK" }, { id: "archive", label: "ARCHIVES" }].map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)} className="tab-btn"
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "11px 22px",
                fontFamily: "'Bebas Neue', cursive", fontSize: 15, letterSpacing: 2,
                color: tab === t.id ? "#f59e0b" : "#44403c",
                borderBottom: tab === t.id ? "2px solid #f59e0b" : "2px solid transparent",
                marginBottom: -1, transition: "color 0.2s",
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* ═══════════════════════════════
            THIS WEEK TAB
        ═══════════════════════════════ */}
        {tab === "week" && (
          <div style={{ animation: "fadeUp 0.35s ease", display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Week info strip */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(245,158,11,0.12)",
              borderRadius: 12, padding: "14px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
            }}>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20, letterSpacing: 2 }}>
                  WEEK OF {new Date(currentWeek).toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase()}
                </div>
                <div style={{ color: "#57534e", fontSize: 12, marginTop: 2 }}>
                  One entry per person · Community vote determines the winner
                </div>
              </div>
              {votedThisWeek && (
                <div style={{
                  background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 8, padding: "5px 13px",
                  fontFamily: "'Bebas Neue', cursive", fontSize: 12, letterSpacing: 2, color: "#f59e0b",
                }}>VOTED ✓</div>
              )}
            </div>

            {/* ── VOTE SECTION (top) ── */}
            <div>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14,
              }}>
                <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 13, letterSpacing: 3, color: "#57534e" }}>
                  <span style={{ color: "#f59e0b" }}>①</span> VOTE FOR THE BEST
                </div>
                {tracks.length > 0 && (
                  <span style={{ fontSize: 11, color: "#44403c", letterSpacing: 1 }}>
                    {tracks.length} TRACK{tracks.length !== 1 ? "S" : ""}
                  </span>
                )}
              </div>

              {tracks.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: "36px 20px",
                  color: "#44403c", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 12,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.35 }}>🎵</div>
                  <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 17, letterSpacing: 2, marginBottom: 5 }}>NO TRACKS YET</div>
                  <p style={{ fontSize: 12, maxWidth: 240, margin: "0 auto", lineHeight: 1.7 }}>
                    Be the first to submit below. Voting opens once entries are in.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {!votedThisWeek && userName && (
                    <div style={{ fontSize: 10, color: "#57534e", letterSpacing: 1, marginBottom: 2, textAlign: "center" }}>
                      YOU HAVE 1 VOTE — USE IT WISELY
                    </div>
                  )}
                  {sortedTracks.map((track, i) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      rank={i}
                      onVote={() => handleVote(track.id)}
                      hasVoted={votedThisWeek}
                      isCurrentUser={track.userId === "user_me"}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

            {/* ── SUBMIT SECTION (bottom) ── */}
            <div>
              <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 13, letterSpacing: 3, color: "#57534e", marginBottom: 16 }}>
                <span style={{ color: "#f59e0b" }}>②</span> SUBMIT YOUR TRACK
              </div>

              {!userName && (
                <div style={{
                  textAlign: "center", padding: "32px 16px",
                  color: "#44403c", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 12,
                }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>♪</div>
                  <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 17, letterSpacing: 2, marginBottom: 6 }}>SET YOUR NAME TO ENTER</div>
                  <p style={{ fontSize: 12 }}>Enter your display name above to compete.</p>
                </div>
              )}

              {userName && hasUploadedThisWeek && (
                <div style={{
                  textAlign: "center", padding: "32px 16px",
                  background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12,
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                  <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 19, letterSpacing: 2, color: "#f59e0b", marginBottom: 4 }}>TRACK SUBMITTED</div>
                  <p style={{ color: "#78716c", fontSize: 12 }}>Your entry is in — vote for your favourites above.</p>
                </div>
              )}

              {userName && !hasUploadedThisWeek && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 10, letterSpacing: 2, color: "#57534e", display: "block", marginBottom: 7 }}>TRACK NAME</label>
                    <input
                      value={trackName}
                      onChange={(e) => setTrackName(e.target.value)}
                      placeholder="Give your track a name"
                      style={{
                        width: "100%", background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(245,158,11,0.2)", borderRadius: 9,
                        padding: "11px 13px", color: "#fef3c7",
                        fontFamily: "'Outfit', sans-serif", fontSize: 14,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 10, letterSpacing: 2, color: "#57534e", display: "block", marginBottom: 7 }}>AUDIO FILE</label>
                    <div
                      className="upload-zone"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: "2px dashed rgba(245,158,11,0.25)", borderRadius: 10,
                        padding: "28px 16px", textAlign: "center", cursor: "pointer",
                        transition: "all 0.2s", background: audioFile ? "rgba(245,158,11,0.04)" : "transparent",
                      }}
                    >
                      <div style={{ fontSize: 26, marginBottom: 8 }}>{audioFile ? "🎵" : "⬆"}</div>
                      <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 15, letterSpacing: 2, marginBottom: 4 }}>
                        {audioFile ? audioFile.name : "TAP TO CHOOSE FILE"}
                      </div>
                      <div style={{ color: "#44403c", fontSize: 11 }}>
                        {audioFile ? `${(audioFile.size / 1024 / 1024).toFixed(1)} MB` : "MP3, WAV, OGG, FLAC"}
                      </div>
                      <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleFileChange} />
                    </div>
                  </div>

                  {audioURL && <PreviewPlayer src={audioURL} name={trackName} />}

                  <button
                    onClick={handleUpload} className="submit-btn"
                    style={{
                      background: "linear-gradient(135deg,#f59e0b,#d97706)",
                      border: "none", borderRadius: 9, padding: "14px",
                      color: "#1a1208", cursor: "pointer",
                      fontFamily: "'Bebas Neue', cursive", fontSize: 16, letterSpacing: 3,
                      transition: "opacity 0.2s",
                    }}
                  >SUBMIT TRACK</button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ═══════════════════════════════
            ARCHIVES TAB
        ═══════════════════════════════ */}
        {tab === "archive" && (
          <div style={{ animation: "fadeUp 0.35s ease" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {archiveWeeks.map((wk) => (
                <button
                  key={wk} onClick={() => setArchiveWeek(wk)}
                  style={{
                    background: currentArchive === wk ? "rgba(245,158,11,0.12)" : "transparent",
                    border: `1px solid ${currentArchive === wk ? "#f59e0b" : "rgba(255,255,255,0.08)"}`,
                    color: currentArchive === wk ? "#f59e0b" : "#57534e",
                    borderRadius: 8, padding: "7px 15px", cursor: "pointer",
                    fontFamily: "'Bebas Neue', cursive", fontSize: 13, letterSpacing: 1, transition: "all 0.2s",
                  }}
                >
                  {new Date(wk).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
                </button>
              ))}
            </div>

            {currentArchive && (
              <div>
                <div style={{ marginBottom: 18 }}>
                  <h3 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 24, letterSpacing: 2, marginBottom: 4 }}>
                    WEEK OF {new Date(currentArchive).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase()}
                  </h3>
                  {(() => {
                    const winner = [...DEMO_TRACKS[currentArchive]].sort((a, b) => b.votes - a.votes)[0];
                    return (
                      <div style={{ fontSize: 13, color: "#57534e" }}>
                        Winner:{" "}
                        <span style={{ color: "#f59e0b", fontFamily: "'Bebas Neue', cursive", letterSpacing: 1 }}>
                          {winner.trackName} by {winner.userName}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[...DEMO_TRACKS[currentArchive]]
                    .sort((a, b) => b.votes - a.votes)
                    .map((track, i) => (
                      <TrackRow key={track.id} track={track} rank={i} />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        <footer style={{ marginTop: 56, paddingBottom: 36, textAlign: "center", color: "#1e1812", fontSize: 11, letterSpacing: 3 }}>
          TRACK BATTLE · WEEKLY SONG CHALLENGE
        </footer>
      </div>
    </div>
  );
}
