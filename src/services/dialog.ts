import { t } from "../i18n";
import { reactive } from "vue";

export type ToastKind = "info" | "ok" | "danger";

type ConfirmRequest = {
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
};

/** État global des dialogues, rendu par <AppDialogs /> (remplace alert() / confirm()). */
export const dialogState = reactive({
  toasts: [] as { id: number; kind: ToastKind; text: string }[],
  confirm: null as ConfirmRequest | null
});

let nextToastId = 1;

export function toast(text: string, kind: ToastKind = "info", ms = 3500): void {
  const id = nextToastId++;
  dialogState.toasts.push({ id, kind, text });
  setTimeout(() => dismissToast(id), ms);
}

export function dismissToast(id: number): void {
  const i = dialogState.toasts.findIndex((t) => t.id === id);
  if (i >= 0) dialogState.toasts.splice(i, 1);
}

export function confirmDialog(
  message: string,
  opts: { confirmLabel?: string; danger?: boolean } = {}
): Promise<boolean> {
  dialogState.confirm?.resolve(false);
  return new Promise((resolve) => {
    dialogState.confirm = {
      message,
      confirmLabel: opts.confirmLabel ?? t("common.confirm"),
      danger: opts.danger ?? true,
      resolve
    };
  });
}

export function answerConfirm(ok: boolean): void {
  const c = dialogState.confirm;
  dialogState.confirm = null;
  c?.resolve(ok);
}
