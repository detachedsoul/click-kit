export type DuplicateFile = { id: string; file: File; hash: string };
export type DuplicateGroup = { hash: string; files: DuplicateFile[]; size: number; sameName: boolean };

export const groupDuplicates = (records: DuplicateFile[]): DuplicateGroup[] => {
	const groups = new Map<string, DuplicateFile[]>();
	for (const record of records) {
		const matches = groups.get(record.hash) ?? [];
		matches.push(record);
		groups.set(record.hash, matches);
	}
	return [...groups.entries()]
		.filter(([, files]) => files.length > 1)
		.map(([hash, files]) => ({ hash, files, size: files[0].file.size, sameName: new Set(files.map(({ file }) => file.name)).size === 1 }))
		.sort((a, b) => b.size - a.size || a.files[0].file.name.localeCompare(b.files[0].file.name));
};

export const reportCsv = (groups: DuplicateGroup[], removeIds: Set<string>) => {
	const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
	const rows = [["SHA-256", "File name", "Size (bytes)", "Action"]];
	for (const group of groups) for (const { id, file } of group.files) rows.push([group.hash, file.name, String(file.size), removeIds.has(id) ? "Remove from cleaned ZIP" : "Keep"]);
	return rows.map((row) => row.map(quote).join(",")).join("\r\n");
};

export const duplicateWorkerSource = `
onmessage = async ({ data: files }) => {
  try {
    for (let i = 0; i < files.length; i++) {
      const { id, file } = files[i];
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      postMessage({ id, hash, done: i + 1, total: files.length });
    }
    postMessage({ complete: true });
  } catch (error) { postMessage({ error: error instanceof Error ? error.message : 'Could not hash files.' }); }
};`;

export const hashFilesInWorker = (files: { id: string; file: File }[], onProgress: (done: number, total: number) => void) =>
	new Promise<Map<string, string>>((resolve, reject) => {
		if (!globalThis.crypto?.subtle) return reject(new Error("Secure file hashing is unavailable in this browser context. Try HTTPS or a modern browser."));
		let worker: Worker | null = null;
		let workerUrl: string | null = null;
		const hashes = new Map<string, string>();
		const cleanup = () => { worker?.terminate(); if (workerUrl) URL.revokeObjectURL(workerUrl); };
		try {
			workerUrl = URL.createObjectURL(new Blob([duplicateWorkerSource], { type: "text/javascript" }));
			worker = new Worker(workerUrl);
			worker.onmessage = ({ data }) => {
				if (data.error) { cleanup(); reject(new Error(data.error)); return; }
				if (data.complete) { cleanup(); resolve(hashes); return; }
				if (data.id && data.hash) { hashes.set(data.id, data.hash); onProgress(data.done, data.total); }
			};
			worker.onerror = () => { cleanup(); reject(new Error("The hashing worker failed. Please try a smaller selection.")); };
			worker.postMessage(files);
		} catch {
			cleanup();
			void (async () => {
				try {
					for (let i = 0; i < files.length; i++) {
						const { id, file } = files[i];
						const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
						hashes.set(id, Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""));
						onProgress(i + 1, files.length);
					}
					resolve(hashes);
				} catch (error) { reject(error instanceof Error ? error : new Error("Could not hash files.")); }
			})();
		}
	});
