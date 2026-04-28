import { create } from 'zustand';

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
  user: JSON.parse(localStorage.getItem('travelai_user')) || null,
  token: localStorage.getItem('travelai_token') || null,

  // Actions
  login: (userData, token) => {
    localStorage.setItem('travelai_user', JSON.stringify(userData));
    localStorage.setItem('travelai_token', token);
    set({ user: userData, token });
  },
  
  logout: () => {
    localStorage.removeItem('travelai_user');
    localStorage.removeItem('travelai_token');
    set({ user: null, token: null, currentTrip: null });
  },

  setUser: (user) => set({ user }),
  setFormData: (data) => set((state) => ({ 
    formData: { ...state.formData, ...data } 
  })),
  
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
