import type { ExternalToast } from "sonner";
import { toast } from "sonner";

type ToastDescription = string | undefined;
type ToastOptions = ExternalToast | undefined;

export const notify = {
  success(title: string, description?: ToastDescription, options?: ToastOptions) {
    toast.success(title, { description, ...options });
  },
  info(title: string, description?: ToastDescription, options?: ToastOptions) {
    toast.info(title, { description, ...options });
  },
  warning(title: string, description?: ToastDescription, options?: ToastOptions) {
    toast.warning(title, { description, ...options });
  },
  error(title: string, description?: ToastDescription, options?: ToastOptions) {
    toast.error(title, { description, ...options });
  },
};
