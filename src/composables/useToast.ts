import { ref } from "vue";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

const toasts = ref<Toast[]>([]);
let nextId = 0;

export function useToast() {
  function show(message: string, type: ToastType = "info", duration = 3000) {
    const id = nextId++;
    toasts.value.push({ id, message, type, duration });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, duration);
  }

  function success(message: string) {
    show(message, "success");
  }

  function error(message: string) {
    show(message, "error", 5000);
  }

  function info(message: string) {
    show(message, "info");
  }

  return { toasts, show, success, error, info };
}
