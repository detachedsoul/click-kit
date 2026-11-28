import Papa from "papaparse";
import { createCsvProfiler } from "@/features/developer-tools/csv-profile-core";

type CsvWorkerMessage = { file: File };
const workerScope = self as unknown as {
	onmessage: ((event: MessageEvent<CsvWorkerMessage>) => void) | null;
	postMessage: (message: unknown) => void;
};

workerScope.onmessage = (event: MessageEvent<CsvWorkerMessage>) => {
	const { file } = event.data;
	const profiler = createCsvProfiler(file);
	let hasHeader = false;
	let delimiter = ",";
	Papa.parse<string[]>(file, {
		dynamicTyping: false,
		header: false,
		skipEmptyLines: "greedy",
		chunkSize: 256 * 1024,
		chunk(results) {
			delimiter = results.meta.delimiter || delimiter;
			profiler.addParseErrors(results.errors.map((error) => `Row ${(error.row ?? 0) + 1}: ${error.message}`));
			for (const row of results.data) {
				if (!hasHeader) {
					profiler.setHeader(row);
					hasHeader = true;
				} else profiler.addRow(row);
			}
		},
		complete() {
			if (!hasHeader) {
				workerScope.postMessage({ error: "This file does not contain a header row. Add a first row with column names and try again." });
				return;
			}
			workerScope.postMessage({ report: profiler.finish(delimiter) });
		},
		error(error) {
			workerScope.postMessage({ error: error.message || "The CSV could not be read." });
		},
	});
};
