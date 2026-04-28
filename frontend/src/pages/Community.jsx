import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Users, Info, Settings, MapPin } from 'lucide-react';
import { io } from 'socket.io-client';
import axios from 'axios';
import useTripStore from '../stores/tripStore';
import './Community.css';

const socket = io('http://localhost:5000');

const Community = () => {
  const { currentTrip, user } = useTripStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]); // Will populate from sockets
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const chatEndRef = useRef(null);

  // 1. Fetch all available rooms from DB
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/chat/rooms');
        setAvailableRooms(res.data);
        
        // Auto-select current trip room if exists, else first global
        const tripRoom = res.data.find(r => r._id === currentTrip?.chatRoom?._id);
        if (tripRoom) {
          setSelectedRoomId(tripRoom._id);
        } else if (res.data.length > 0) {
          setSelectedRoomId(res.data[0]._id);
        }
      } catch (err) {
        console.error('Failed to fetch rooms:', err);
      }
    };
    fetchRooms();
  }, [currentTrip]);

  const activeRoom = availableRooms.find(r => r._id === selectedRoomId);

  useEffect(() => {
    if (!selectedRoomId) return;
    setIsJoined(false); // Reset when switching rooms
    setMessages([]);
  }, [selectedRoomId]);

  const joinHub = () => {
    if (!selectedRoomId) return;
    setIsJoined(true);
    socket.emit('join_room', selectedRoomId);

    const fetchHistory = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/chat/history/${selectedRoomId}`);
        setMessages(res.data.map(m => ({
          ...m,
          role: m.sender === user?.name ? 'own' : 'other'
        })));
      } catch (err) {
        console.error('Failed to load history:', err);
      }
    };
    fetchHistory();
  };

  useEffect(() => {
    if (!selectedRoomId || !isJoined) return;

    socket.on('receive_message', (data) => {
      if (data.roomId === selectedRoomId) {
        setMessages(prev => [...prev, {
          sender: data.sender,
          text: data.text,
          timestamp: new Date(),
          role: data.sender === user?.name ? 'own' : 'other'
        }]);
      }
    });

    return () => {
      socket.off('receive_message');
    };
  }, [selectedRoomId, isJoined, user?.name]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !selectedRoomId || !isJoined) return;
    const messageData = { roomId: selectedRoomId, sender: user?.name || 'Guest', text: input };
    socket.emit('send_message', messageData);
    setInput('');
  };

  return (
    <div className="community-page">
      <div className="community-container">
        <aside className="community-sidebar glass-card">
          <div className="sidebar-header">
            <h3>Explore Hubs</h3>
          </div>
          <div className="room-list">
            {currentTrip?.chatRoom && (
              <div 
                className={`room-item ${selectedRoomId === currentTrip.chatRoom._id ? 'active' : ''}`}
                onClick={() => setSelectedRoomId(currentTrip.chatRoom._id)}
              >
                <div className="room-icon"><MapPin size={18} /></div>
                <div className="room-info">
                  <h4>My Trip Hub</h4>
                  <p>{currentTrip.destination.name.split(',')[0]}</p>
                </div>
              </div>
            )}
            
            {availableRooms.map(room => (
              <div 
                key={room._id}
                className={`room-item ${selectedRoomId === room._id ? 'active' : ''}`}
                onClick={() => setSelectedRoomId(room._id)}
              >
                <div className="room-icon"><Users size={18} /></div>
                <div className="room-info">
                  <h4>{room.roomName}</h4>
                  <p>{room.destination}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="people-list-section">
            <label>Travelers Online</label>
            {isJoined ? (
              <div className="person-item">
                <div className="avatar-circle-small">{user?.name?.[0] || 'U'}</div>
                <div className="person-info">
                  <span className="person-name">{user?.name || 'You'}</span>
                  <span className="person-status">Online now</span>
                </div>
              </div>
            ) : (
              <p className="no-participants">Join a hub to see travelers</p>
            )}
          </div>
        </aside>

        <main className="chat-area glass-card">
          <header className="chat-header">
            <div className="chat-info">
              <h4>{activeRoom?.roomName || 'Select a Hub'}</h4>
              <p>{activeRoom?.destination}</p>
            </div>
            {activeRoom?.inviteCode && isJoined && (
              <div className="room-invite-pill">Code: {activeRoom.inviteCode}</div>
            )}
          </header>

          <div className="message-list-wrapper">
            {!isJoined ? (
              <div className="join-overlay">
                <Users size={48} className="join-icon" />
                <h3>Welcome to the {activeRoom?.roomName}</h3>
                <p>You haven't joined this hub yet. Join now to participate and see history!</p>
                <button className="btn-primary" onClick={joinHub}>Join Hub Now</button>
              </div>
            ) : (
              <div className="message-list">
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
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button className="btn-send" onClick={sendMessage}>
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
