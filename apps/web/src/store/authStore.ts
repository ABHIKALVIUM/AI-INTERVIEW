import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  jobRole?: string;
  experienceLevel?: 'junior' | 'mid' | 'senior';
  onboardingComplete?: boolean;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (user: UserProfile) => void;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
      updateProfile: (profile) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...profile } : null,
        })),
    }),
    {
      name: 'auth-session',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
