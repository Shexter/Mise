import { create } from 'zustand';

/**
 * Whether the centre add surface is open.
 *
 * The `+` is drawn inside the tab bar, the coach mark that points at it lives
 * beside it, and Today's empty state offers the same action — three consumers
 * in two different layers of the tree, so the flag cannot belong to any one of
 * them. It holds no draft data: the sheet only routes, and each destination
 * owns its own state once it is reached.
 */
interface AddSheetState {
  open: boolean;
  /** Set when the sheet is opened by a long press, which offers recent meals. */
  recentMealsOpen: boolean;
  show: () => void;
  hide: () => void;
  showRecentMeals: () => void;
  hideRecentMeals: () => void;
}

export const useAddSheetStore = create<AddSheetState>((set) => ({
  open: false,
  recentMealsOpen: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  // The two are mutually exclusive: a long press goes straight to recents
  // rather than opening the add surface behind it.
  showRecentMeals: () => set({ open: false, recentMealsOpen: true }),
  hideRecentMeals: () => set({ recentMealsOpen: false }),
}));
