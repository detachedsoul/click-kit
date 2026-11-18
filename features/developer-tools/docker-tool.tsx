"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { parseDockerRun, toCompose } from "@/features/developer-tools/docker-utils";
import { ErrorNote, ResultBlock, ToolPanel, hintClassName } from "@/features/developer-tools/tool-ui";

const sample = `docker run -d \\
  --name api \\
  --restart unless-stopped \\
  -p 8080:8080 -p 127.0.0.1:9229:9229 \\
  -v "$PWD/uploads:/app/uploads" \\
  -e NODE_ENV=production \\
  -e "DATABASE_URL=postgres://db:5432/app" \\
  -w /app \\
  --memory 512m --cpus 1.5 \\
  --cap-drop ALL \\
  ghcr.io/acme/api:1.4.2 node server.js --port 8080`;

export const DockerTool = () => {
	const [source, setSource] = useState(sample);
	const result = useMemo(() => {
		try {
			const parsed = parseDockerRun(source);
			return { output: toCompose(parsed), warnings: parsed.warnings, error: "" };
		} catch (error) {
			return { output: "", warnings: [], error: error instanceof Error ? error.message : "Could not convert this command." };
		}
	}, [source]);
	return (
		<ToolPanel>
			<TextAreaField
				id="docker-run"
				label="docker run command"
				value={source}
				onChange={setSource}
				placeholder="docker run -d -p 8080:80 nginx:alpine"
				rows={10}
				hint="Trailing backslash line breaks and quoted values are handled. Flags without a Compose equivalent are listed under the output instead of being guessed."
			/>
			<ErrorNote message={result.error} />
			{result.warnings.length > 0 && (
				<ul className="m-0 flex list-none flex-col gap-1 border border-[#e4d9bd] bg-[#fdf8ec] px-4 py-3 text-xs text-[#6f5718]">
					{result.warnings.map((warning) => (
						<li key={warning}>{warning}</li>
					))}
				</ul>
			)}
			{result.output && <ResultBlock title="docker-compose.yml" value={result.output} rows={18} fileName="docker-compose.yml" />}
			<p className={hintClassName}>
				Ports, volumes, environment variables, restart policy, networks, caps, resource limits, and the container command are all mapped to
				Compose v2 syntax.
			</p>
		</ToolPanel>
	);
};
