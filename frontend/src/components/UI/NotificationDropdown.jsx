import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, ExternalLink, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import axios from 'axios';
import socket from '../../lib/socket';
import useTripStore from '../../stores/tripStore';
import './NotificationDropdown.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const NotificationDropdown = () => {
  const { user, token } = useTripStore();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const activeNotifications = notifications.filter(n => {
    if (!n.expiresAt) return true;
    return new Date(n.expiresAt) > new Date();
  });

  const unreadCount = activeNotifications.filter(n => !n.isRead).length;

  const headers = { Authorization: `Bearer ${token}` };

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/notifications`, { headers });
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleNewNotification = (notification) => {
      setNotifications(prev => [notification, ...prev]);
      // Optional: play sound or show browser notification
    };

    socket.on('new_notification', handleNewNotification);
    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [token]);

  // Force re-render every minute to auto-hide expired notifications
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      await axios.post(`${API}/api/notifications/read/${id}`, {}, { headers });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/api/notifications/read-all`, {}, { headers });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const fmtRelative = (d) => {
    const ms = Date.now() - new Date(d).getTime();
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return new Date(d).toLocaleDateString();
  };

  return (
    <div className="notification-wrapper" ref={dropdownRef}>
      <button
        className={`notification-trigger ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="noti-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="mark-all-btn" onClick={markAllAsRead}>
                <Check size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="noti-body">
            {loading && notifications.length === 0 ? (
              <div className="noti-empty">Loading...</div>
            ) : activeNotifications.length === 0 ? (
              <div className="noti-empty">
                <Bell size={32} />
                <p>No notifications yet</p>
              </div>
            ) : (
              activeNotifications.map((n) => (
                <div
                  key={n._id}
                  className={`noti-item ${n.isRead ? 'read' : 'unread'}`}
                  onClick={() => !n.isRead && markAsRead(n._id)}
                >
                  <div className="noti-icon">
                    {n.type === 'all' ? <Info size={16} /> : <CheckCircle size={16} />}
                  </div>
                  <div className="noti-content">
                    <div className="noti-title-row">
                      <span className="noti-title">{n.title}</span>
                      <span className="noti-time">{fmtRelative(n.createdAt)}</span>
                    </div>
                    <p className="noti-message">{n.message}</p>
                    {n.link && (
                      <a href={n.link} className="noti-link" target="_blank" rel="noopener noreferrer">
                        View detail <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="noti-footer">
             <button onClick={() => setIsOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
