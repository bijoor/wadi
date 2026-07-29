// Tiny UI store: is the Layers editor modal open? Shared so any surface (the
// House-settings section button, the viewer's Show/hide-layers menu, a window
// hook) can open the same modal — the modal itself is mounted once per bundle.
import { create } from "zustand";

interface LayersUiState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useLayersUiStore = create<LayersUiState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
