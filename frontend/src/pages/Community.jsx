import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Send, Users, MapPin, Trophy, Globe2, LogOut, Lock, Sparkles, KeyRound } from 'lucide-react';
import axios from 'axios';
import useTripStore from '../stores/tripStore';
import socket from '../lib/socket';
import { useTranslation } from '../hooks/useTranslation';
import { useToast } from '../components/UI/Toast';
import { useConfirm } from '../components/UI/ConfirmDialog';
import './Community.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Community = () => {
  const navigate = useNavigate();
  // The TripResults "Join Chat" button now navigates here with
  // location.state = { roomId, fromTripId }. Reading this lets us
  // pre-select the trip's room even if `currentTrip` was lost from the
  // store (e.g. after a hard reload). Falls back to the trip-room or
  // global flow gracefully when state is empty (direct nav to /community).
  const location = useLocation();
  const navRoomId = location.state?.roomId || null;
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const {
    currentTrip,
    user,
    token,
    joinedHubs,
    setJoinedHubs,
    addJoinedHub,
    removeJoinedHub,
    refreshSubscription
  } = useTripStore();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [busy, setBusy] = useState(false); // join/leave in flight
  const [inviteCode, setInviteCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const chatEndRef = useRef(null);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // 1) Fetch all rooms + sync the user's joined hubs from the server.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [roomsRes, hubsRes] = await Promise.all([
          axios.get(`${API}/api/chat/rooms`),
          token
            ? axios.get(`${API}/api/chat/me/hubs`, { headers: authHeaders })
            : Promise.resolve({ data: { joinedHubs } })
        ]);
        if (cancelled) return;

        setAvailableRooms(roomsRes.data);
        if (token && Array.isArray(hubsRes.data?.joinedHubs)) {
          setJoinedHubs(hubsRes.data.joinedHubs);
        }

        // Default selection priority:
        //   1. Explicit roomId passed via navigation state (Join Chat button)
        //   2. Current trip's chatRoom from the store
        //   3. First room the user has joined
        //   4. The global default room
        const navRoom = navRoomId && roomsRes.data.find((r) => String(r._id) === String(navRoomId));
        const tripRoomId = currentTrip?.chatRoom?._id;
        const tripRoom = roomsRes.data.find((r) => r._id === tripRoomId);
        const serverHubs = hubsRes.data?.joinedHubs || joinedHubs;
        const firstJoined = roomsRes.data.find((r) => serverHubs.includes(String(r._id)));
        const fallback = roomsRes.data.find((r) => r.isGlobalDefault) || roomsRes.data[0];
        setSelectedRoomId(navRoom?._id || tripRoom?._id || firstJoined?._id || fallback?._id || null);
      } catch (err) {
        console.error('Failed to fetch rooms:', err);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentTrip?.chatRoom?._id, navRoomId]);

  const activeRoom = availableRooms.find((r) => r._id === selectedRoomId);
  const isJoined = !!selectedRoomId && joinedHubs.includes(String(selectedRoomId));

  // 2) Reset messages when switching rooms; auto-load history if already a member.
  useEffect(() => {
    setMessages([]);
    if (!selectedRoomId || !isJoined) return;

    let cancelled = false;
    socket.emit('join_room', selectedRoomId);
    (async () => {
      try {
        const res = await axios.get(`${API}/api/chat/history/${selectedRoomId}`);
        if (cancelled) return;
        setMessages(
          res.data.map((m) => ({
            ...m,
            role: m.sender === user?.name ? 'own' : 'other'
          }))
        );
      } catch (err) {
        console.error('Failed to load history:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedRoomId, isJoined, user?.name]);

  // 3) Live message subscription.
  useEffect(() => {
    if (!selectedRoomId || !isJoined) return;
    const handler = (data) => {
      if (data.roomId !== selectedRoomId) return;
      setMessages((prev) => [
        ...prev,
        {
          sender: data.sender,
          text: data.text,
          timestamp: new Date(),
          role: data.sender === user?.name ? 'own' : 'other'
        }
      ]);
    };
    // The backend now plan-gates `send_message`; if the user's plan
    // doesn't unlock `community` it emits this error event back instead
    // of broadcasting. Surface it as a toast and nudge to /billing.
    const errHandler = (payload = {}) => {
      const msg = payload.message || 'Message blocked.';
      toast.error(msg);
      if (payload.code === 'upgrade_required' && payload.upgradeUrl) {
        // Soft redirect after a tick so the toast is visible.
        setTimeout(() => { window.location.href = payload.upgradeUrl; }, 800);
      }
    };
    socket.on('receive_message', handler);
    socket.on('send_message_error', errHandler);
    return () => {
      socket.off('receive_message', handler);
      socket.off('send_message_error', errHandler);
    };
  }, [selectedRoomId, isJoined, user?.name, toast]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !selectedRoomId || !isJoined) return;
    socket.emit('send_message', {
      roomId: selectedRoomId,
      sender: user?.name || 'Guest',
      text: input
    });
    setInput('');
    // Best-effort freemium counter refresh. The backend increments the
    // counter inside the socket handler on success; we can't await that
    // round-trip cheaply, so we just refetch the subscription a moment
    // later. If the message was rejected, `send_message_error` already
    // fired and `refreshSubscription` will return the unchanged value.
    setTimeout(() => { refreshSubscription?.(); }, 350);
  };

  // Local member-count adjustment so the badge updates instantly without
  // a refetch. The backend remains the source of truth on next page load.
  const adjustMemberCount = (roomId, delta) => {
    setAvailableRooms((prev) =>
      prev.map((r) =>
        String(r._id) === String(roomId)
          ? { ...r, memberCount: Math.max(0, (r.memberCount || 0) + delta) }
          : r
      )
    );
  };

  const handleJoin = async (roomId) => {
    if (!roomId || busy) return;
    if (!token) {
      navigate('/login');
      return;
    }
    // Avoid double-counting if the user clicks "join" twice.
    const wasAlreadyJoined = joinedHubs.includes(String(roomId));
    setBusy(true);
    try {
      const res = await axios.post(
        `${API}/api/chat/rooms/${roomId}/join`,
        {},
        { headers: authHeaders }
      );
      if (Array.isArray(res.data?.joinedHubs)) {
        setJoinedHubs(res.data.joinedHubs);
      } else {
        addJoinedHub(roomId);
      }
      if (!wasAlreadyJoined) adjustMemberCount(roomId, +1);
      setSelectedRoomId(roomId);
    } catch (err) {
      console.error('Join failed:', err);
      toast.error(err.response?.data?.error || t('community.joinError'));
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async (roomId) => {
    if (!roomId || busy) return;
    if (!token) return;
    const room = availableRooms.find((r) => r._id === roomId);
    const ok = await confirm({
      title: `${t('community.leaveTitle')} “${room?.roomName || 'this hub'}”?`,
      message: t('community.leaveMsg'),
      confirmLabel: t('community.leaveBtn'),
      cancelLabel: t('community.stayBtn'),
      variant: 'danger'
    });
    if (!ok) return;
    const wasJoined = joinedHubs.includes(String(roomId));
    setBusy(true);
    try {
      const res = await axios.post(
        `${API}/api/chat/rooms/${roomId}/leave`,
        {},
        { headers: authHeaders }
      );
      const newHubs = Array.isArray(res.data?.joinedHubs)
        ? res.data.joinedHubs
        : joinedHubs.filter((id) => id !== String(roomId));
      if (Array.isArray(res.data?.joinedHubs)) {
        setJoinedHubs(newHubs);
      } else {
        removeJoinedHub(roomId);
      }
      if (wasJoined) adjustMemberCount(roomId, -1);
      // If the user just left the room they were viewing, jump to another
      // joined room (or the trip room) so the empty overlay doesn't linger.
      if (String(selectedRoomId) === String(roomId)) {
        const fallback =
          (currentTrip?.chatRoom?._id && currentTrip.chatRoom._id) ||
          availableRooms.find(
            (r) => r._id !== roomId && newHubs.includes(String(r._id))
          )?._id ||
          null;
        setSelectedRoomId(fallback);
      }
    } catch (err) {
      console.error('Leave failed:', err);
      toast.error(err.response?.data?.error || t('community.leaveError'));
    } finally {
      setBusy(false);
    }
  };

  // Join by invite code — looks up against the rooms we already have, then
  // delegates to the regular join flow so persistence stays consistent.
  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    const code = inviteCode.trim().toUpperCase();
    setCodeError('');
    if (!code) return;
    if (!token) {
      navigate('/login');
      return;
    }
    const room = availableRooms.find(
      (r) => (r.inviteCode || '').toUpperCase() === code
    );
    if (!room) {
      setCodeError(t('community.noHubCode'));
      return;
    }
    if (joinedHubs.includes(String(room._id))) {
      setSelectedRoomId(room._id);
      setInviteCode('');
      return;
    }
    await handleJoin(room._id);
    setInviteCode('');
  };

  // Categorize rooms for the sidebar.
  // Per UX: leaving a hub removes it from the list (only joined non-fan rooms
  // are shown). Fan rooms always appear so users can discover them and become a fan.
  const tripRoomId = currentTrip?.chatRoom?._id;
  const myJoinedHubs = availableRooms.filter(
    (r) =>
      !r.isWorldCupFanRoom &&
      r._id !== tripRoomId &&
      joinedHubs.includes(String(r._id))
  );
  const fanRooms = availableRooms.filter((r) => r.isWorldCupFanRoom);

  const renderRoomItem = (room, opts = {}) => {
    const isActive = selectedRoomId === room._id;
    const joined = joinedHubs.includes(String(room._id));
    const isFanLocked = room.isWorldCupFanRoom && !joined;
    const Icon = opts.icon || Users;
    const count = room.memberCount || 0;
    return (
      <button
        type="button"
        key={room._id}
        className={`room-item ${isActive ? 'active' : ''} ${isFanLocked ? 'fan-locked' : ''}`}
        onClick={() => setSelectedRoomId(room._id)}
      >
        <div className={`room-icon ${room.isWorldCupFanRoom ? 'fan' : ''}`}>
          <Icon size={18} />
        </div>
        <div className="room-info">
          <h4>
            {room.roomName}
            {room.isGlobalDefault && <span className="room-tag default">{t('community.defaultTag')}</span>}
            {joined && !room.isGlobalDefault && <span className="room-tag joined">{t('community.joinedTag')}</span>}
            {isFanLocked && (
              <span className="room-tag locked"><Lock size={10} /> {t('community.fansOnlyTag')}</span>
            )}
          </h4>
          <p>
            {room.destination}
            {room.destination ? ' · ' : ''}
            <span className="member-mini" title={`${count} ${count === 1 ? t('community.member') : t('community.members')}`}>
              <Users size={10} /> {count}
            </span>
          </p>
        </div>
      </button>
    );
  };

  return (
    <div className="community-page">
      <div className="community-container">
        <aside className="community-sidebar glass-card">
          <div className="sidebar-header">
            <h3>{t('community.myHubs')}</h3>
            <p className="sidebar-sub">{t('community.myHubsSub')}</p>
          </div>

          <form className="join-by-code" onSubmit={handleCodeSubmit}>
            <div className="join-by-code-input">
              <KeyRound size={14} />
              <input
                type="text"
                placeholder={t('community.invitePlaceholder')}
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase());
                  setCodeError('');
                }}
                maxLength={20}
                aria-label="Invite code"
              />
              <button
                type="submit"
                className="btn-code-go"
                disabled={!inviteCode.trim() || busy}
              >
                {t('community.joinCodeBtn')}
              </button>
            </div>
            {codeError && <span className="code-error">{codeError}</span>}
          </form>

          <div className="room-list">
            {currentTrip?.chatRoom && (
              <button
                type="button"
                className={`room-item ${selectedRoomId === currentTrip.chatRoom._id ? 'active' : ''}`}
                onClick={() => setSelectedRoomId(currentTrip.chatRoom._id)}
              >
                <div className="room-icon"><MapPin size={18} /></div>
                <div className="room-info">
                  <h4>{t('community.myTripHub')}</h4>
                  <p>{currentTrip.destination?.name?.split(',')[0]}</p>
                </div>
              </button>
            )}

            {myJoinedHubs.length > 0 && (
              <>
                <div className="room-group-label">{t('community.travelHubs')}</div>
                {myJoinedHubs.map((room) =>
                  renderRoomItem(room, { icon: room.isGlobalDefault ? Globe2 : Users })
                )}
              </>
            )}

            {fanRooms.length > 0 && (
              <>
                <div className="room-group-label fan">{t('community.fanRooms')}</div>
                {fanRooms.map((room) => renderRoomItem(room, { icon: Trophy }))}
              </>
            )}

            {myJoinedHubs.length === 0 && !currentTrip?.chatRoom && fanRooms.length === 0 && (
              <p className="sidebar-empty">
                {t('community.emptySidebar')}
              </p>
            )}
          </div>

          <div className="people-list-section">
            <label>{t('community.you')}</label>
            {user ? (
              <div className="person-item">
                <div className="avatar-circle-small">{user?.name?.[0] || 'U'}</div>
                <div className="person-info">
                  <span className="person-name">{user?.name}</span>
                  <span className="person-status">
                    {joinedHubs.length} {joinedHubs.length === 1 ? t('community.hubJoined') : t('community.hubsJoined')}
                  </span>
                </div>
              </div>
            ) : (
              <button className="btn-link-login" onClick={() => navigate('/login')}>
                {t('community.signInPrompt')}
              </button>
            )}
          </div>
        </aside>

        <main className="chat-area glass-card">
          <header className="chat-header">
            <div className="chat-info">
              <h4>{activeRoom?.roomName || t('community.selectHub')}</h4>
              {activeRoom && (
                <div className="chat-info-meta">
                  {activeRoom.destination && <span>{activeRoom.destination}</span>}
                  {activeRoom.destination && <span className="meta-dot">·</span>}
                  <span className="member-count" title="Total members">
                    <Users size={12} />
                    {activeRoom.memberCount || 0}
                    {' '}
                    {activeRoom.memberCount === 1 ? t('community.member') : t('community.members')}
                  </span>
                </div>
              )}
            </div>
            <div className="chat-header-actions">
              {activeRoom?.inviteCode && isJoined && (
                <div className="room-invite-pill">{t('community.codeLabel')}: {activeRoom.inviteCode}</div>
              )}
              {isJoined && activeRoom && (
                <button
                  type="button"
                  className="btn-leave-hub"
                  onClick={() => handleLeave(activeRoom._id)}
                  disabled={busy}
                  title={activeRoom.isGlobalDefault ? t('community.leaveDefaultHint') : t('community.leaveHubHint')}
                >
                  <LogOut size={14} /> {t('community.leaveText')}
                </button>
              )}
            </div>
          </header>

          <div className="message-list-wrapper">
            {!activeRoom ? (
              <div className="join-overlay">
                <Users size={48} className="join-icon" />
                <h3>{t('community.pickHubTitle')}</h3>
                <p>{t('community.pickHubSub')}</p>
              </div>
            ) : !isJoined ? (
              <div className="join-overlay">
                {activeRoom.isWorldCupFanRoom ? (
                  <Trophy size={48} className="join-icon fan" />
                ) : (
                  <Users size={48} className="join-icon" />
                )}
                <h3>
                  {activeRoom.isWorldCupFanRoom
                    ? `${t('community.becomeFanTitle')} ${activeRoom.roomName}`
                    : `${t('community.welcomeTitle')} ${activeRoom.roomName}`}
                </h3>
                <p>
                  {activeRoom.description ||
                    (activeRoom.isWorldCupFanRoom
                      ? t('community.fanRoomDesc')
                      : t('community.travelHubDesc'))}
                </p>
                <button
                  className="btn-primary"
                  onClick={() => handleJoin(activeRoom._id)}
                  disabled={busy}
                >
                  {activeRoom.isWorldCupFanRoom ? (
                    <><Sparkles size={16} /> {t('community.becomeFanBtn')}</>
                  ) : (
                    <>{t('community.joinHubBtn')}</>
                  )}
                </button>
              </div>
            ) : (
              <div className="message-list">
                {messages.length === 0 && (
                  <div className="empty-chat-hint">
                    {t('community.emptyChatHint')}
                  </div>
                )}
                {messages.map((m, idx) => (
                  <div key={idx} className={`message-item ${m.role === 'own' ? 'own' : ''}`}>
                    {m.role !== 'own' && <span className="user-name">{m.sender}</span>}
                    <div className="message-bubble">
                      <p>{m.text}</p>
                      <span className="time">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {isJoined && (
            <div className="chat-input-container">
              <input
                type="text"
                placeholder={t('community.typePlaceholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button className="btn-send" onClick={sendMessage} aria-label="Send">
                <Send size={20} />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Community;
