import { create } from 'zustand';

// Read joinedHubs from a freshly hydrated user object (login response or
// previously stored localStorage user) so we don't lose membership state
// on page refresh.
const initialUser = JSON.parse(localStorage.getItem('travelai_user')) || null;
const initialJoinedHubs = (() => {
  const fromUser = Array.isArray(initialUser?.joinedHubs) ? initialUser.joinedHubs : [];
  if (fromUser.length) return fromUser.map(String);
  try {
    const cached = JSON.parse(localStorage.getItem('travelai_joined_hubs') || '[]');
    return Array.isArray(cached) ? cached.map(String) : [];
  } catch {
    return [];
  }
})();

const persistJoinedHubs = (ids) => {
  try {
    localStorage.setItem('travelai_joined_hubs', JSON.stringify(ids));
  } catch {
    /* ignore quota errors */
  }
};

// Tiny helpers for the UI prefs we want to survive a reload (theme +
// language). Kept inline so a quota error or disabled storage just
// silently falls back to the defaults rather than crashing the app.
const readPref = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch { return fallback; }
};
const writePref = (key, value) => {
  try { localStorage.setItem(key, String(value)); } catch { /* ignore */ }
};

// Hydrate UI prefs from localStorage so the very first render uses the
// user's last choice — no flash of the wrong theme on reload.
const initialLanguage = readPref('travelai_lang', 'en');
const initialDarkMode = readPref('travelai_theme', 'dark') !== 'light';
// Apply theme class synchronously before React paints.
if (typeof document !== 'undefined') {
  if (initialDarkMode) document.body.classList.remove('light-mode');
  else document.body.classList.add('light-mode');
}

const useTripStore = create((set, get) => ({
  // Form Data
  formData: {
    destination: { name: '', lat: null, lon: null },
    dates: { start: '', end: '' },
    travelers: 'solo', // solo, couple, family, group
    budget: { total: 1000, currency: 'USD' },
    style: 'balanced', // economy, balanced, comfort, luxury
    interests: [],
    dietary: []
  },

  // UI State
  step: 1,
  isGenerating: false,
  language: initialLanguage,
  isDarkMode: initialDarkMode,
  
  // Results
  currentTrip: null,
  user: initialUser,
  token: localStorage.getItem('travelai_token') || null,
  // Persistent hub membership (room ids the user has joined). The Global
  // Travel Hub is auto-added by the backend on signup. Click-to-join only once.
  joinedHubs: initialJoinedHubs,

  // Actions
  login: (userData, token) => {
    localStorage.setItem('travelai_user', JSON.stringify(userData));
    localStorage.setItem('travelai_token', token);
    const hubs = Array.isArray(userData?.joinedHubs) ? userData.joinedHubs.map(String) : [];
    persistJoinedHubs(hubs);
    set({ user: userData, token, joinedHubs: hubs });
  },
  
  logout: () => {
    localStorage.removeItem('travelai_user');
    localStorage.removeItem('travelai_token');
    localStorage.removeItem('travelai_joined_hubs');
    set({ user: null, token: null, currentTrip: null, joinedHubs: [] });
  },

  setUser: (user) => {
    if (user) localStorage.setItem('travelai_user', JSON.stringify(user));
    else localStorage.removeItem('travelai_user');
    set({ user });
  },

  // Replaces just the subscription block on the cached user — used by the
  // Billing and Settings pages after a PayPal capture or admin grant.
  setSubscription: (subscription) => set((state) => {
    if (!state.user) return state;
    const next = { ...state.user, subscription };
    localStorage.setItem('travelai_user', JSON.stringify(next));
    return { user: next };
  }),

  // Re-fetches the freemium counter + plan state from the backend.
  // Called after every action that consumes a free use (refine,
  // livemap post, community message, trip generate) so the
  // <FreemiumGate> overlay flips to "locked" the moment the 3rd use
  // is consumed — without forcing the user to reload the page.
  // Errors are swallowed: this is a best-effort refresh, the next
  // /me call on a navigation will eventually correct any drift.
  refreshSubscription: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/payments/subscription', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const subscription = await res.json();
      set((state) => {
        if (!state.user) return state;
        const next = { ...state.user, subscription };
        localStorage.setItem('travelai_user', JSON.stringify(next));
        return { user: next };
      });
    } catch (_) { /* network — ignore */ }
  },

  setFormData: (data) => set((state) => ({ 
    formData: { ...state.formData, ...data } 
  })),

  // Hub membership helpers — kept tiny so any page can call them.
  setJoinedHubs: (ids) => {
    const list = (ids || []).map(String);
    persistJoinedHubs(list);
    set({ joinedHubs: list });
  },
  addJoinedHub: (id) => set((state) => {
    const sid = String(id);
    if (state.joinedHubs.includes(sid)) return state;
    const next = [...state.joinedHubs, sid];
    persistJoinedHubs(next);
    return { joinedHubs: next };
  }),
  removeJoinedHub: (id) => set((state) => {
    const sid = String(id);
    if (!state.joinedHubs.includes(sid)) return state;
    const next = state.joinedHubs.filter((x) => x !== sid);
    persistJoinedHubs(next);
    return { joinedHubs: next };
  }),
  
  nextStep: () => set((state) => ({ step: state.step + 1 })),
  prevStep: () => set((state) => ({ step: state.step - 1 })),
  setStep: (step) => set({ step }),

  setTrip: (trip) => set({ currentTrip: trip }),
  setGenerating: (status) => set({ isGenerating: status }),
  setLanguage: (lang) => {
    writePref('travelai_lang', lang);
    set({ language: lang });
  },
  toggleDarkMode: () => set((state) => {
    const newVal = !state.isDarkMode;
    document.body.classList.toggle('light-mode', !newVal);
    writePref('travelai_theme', newVal ? 'dark' : 'light');
    return { isDarkMode: newVal };
  }),

  resetStore: () => set({
    formData: {
      destination: { name: '', lat: null, lon: null },
      dates: { start: '', end: '' },
      travelers: 'solo',
      budget: { total: 1000, currency: 'USD' },
      style: 'balanced',
      interests: [],
      dietary: []
    },
    step: 1,
    currentTrip: null
  })
}));

export default useTripStore;
