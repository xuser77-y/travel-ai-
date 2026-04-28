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

const useTripStore = create((set) => ({
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
  language: 'en',
  isDarkMode: true,
  
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
  setLanguage: (lang) => set({ language: lang }),
  toggleDarkMode: () => set((state) => {
    const newVal = !state.isDarkMode;
    document.body.classList.toggle('light-mode', !newVal);
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
