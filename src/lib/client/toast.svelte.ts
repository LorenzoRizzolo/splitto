export type Toast = {
	id: number;
	message: string;
	kind: 'success' | 'error' | 'info';
	action?: { label: string; run: () => void | Promise<void> };
	duration: number;
};

let nextId = 1;

class ToastStore {
	items = $state<Toast[]>([]);

	show(message: string, opts: Partial<Omit<Toast, 'id' | 'message'>> = {}) {
		const toast: Toast = { id: nextId++, message, kind: 'success', duration: 4000, ...opts };
		this.items = [...this.items.slice(-2), toast];
		if (toast.duration > 0) setTimeout(() => this.dismiss(toast.id), toast.duration);
		return toast.id;
	}

	success(message: string, opts?: Partial<Toast>) {
		return this.show(message, { ...opts, kind: 'success' });
	}

	error(message: string, opts?: Partial<Toast>) {
		return this.show(message, { duration: 6000, ...opts, kind: 'error' });
	}

	dismiss(id: number) {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

export const toasts = new ToastStore();
