import { onMounted, onUnmounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { confirmDialog } from "../services/dialog";

/**
 * Asks for confirmation before leaving a session in progress
 * (router navigation, Android back button, tab close / reload).
 */
export function useSessionGuard(inProgress: () => boolean) {
  onBeforeRouteLeave(async () => {
    if (!inProgress()) return true;
    return confirmDialog("Quitter la session ? Ta progression en cours sera perdue.", { confirmLabel: "Quitter" });
  });

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!inProgress()) return;
    e.preventDefault();
    e.returnValue = "";
  };
  onMounted(() => window.addEventListener("beforeunload", onBeforeUnload));
  onUnmounted(() => window.removeEventListener("beforeunload", onBeforeUnload));
}
