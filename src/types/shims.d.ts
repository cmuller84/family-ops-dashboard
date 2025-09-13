declare module '@dnd-kit/sortable' {
  export const SortableContext: any;
  export const arrayMove: any;
  export const sortableKeyboardCoordinates: any;
  export const verticalListSortingStrategy: any;
  export const useSortable: any;
}

// Global window shims for QA diagnostics and toasts
declare global {
  interface Window {
    __qaReady?: (name?: string) => void
    __qaReadyPromise?: (name?: string) => Promise<boolean>
    __qaReadyPromiseInitialized?: boolean
    __toastPing?: (msg?: string) => void
    __toastMountLog?: Array<{ t: number; msg?: string }>
  }
}
export {}
