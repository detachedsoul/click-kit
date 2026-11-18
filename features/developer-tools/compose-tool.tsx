"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { composeServiceNames, composeToRun } from "@/features/developer-tools/compose-utils";
import { CheckboxField, ErrorNote, hintClassName, labelClassName, ResultBlock, selectClassName, ToolPanel } from "@/features/developer-tools/tool-ui";

const sample = `services:
  api:
    image: ghcr.io/acme/api:1.4.2
    container_name: api
    restart: unless-stopped
    ports:
      - "8080:8080"
      - "127.0.0.1:9229:9229"
    volumes:
      - ./uploads:/app/uploads
      - type: bind
        source: ./cache
        target: /cache
        read_only: true
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://db:5432/app
      LOG_LEVEL: info
    working_dir: /app
    networks:
      - frontend
    cap_drop:
      - ALL
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 512m
    command: ["node", "server.js", "--port", "8080"]
  worker:
    image: ghcr.io/acme/worker:1.4.2
    environment:
      QUEUE: default
    depends_on:
      - api`;

export const ComposeTool = () => {
	const [source, setSource] = useState(sample);
	const [service, setService] = useState("api");
	const [detach, setDetach] = useState(true);
	const [rm, setRm] = useState(false);
	const names = useMemo(() => {
		try {
			return composeServiceNames(source).names;
		} catch {
			return [];
		}
	}, [source]);
	const result = useMemo(() => {
		try {
			return { ...composeToRun(source, { service, detach, rm }), error: "" };
		} catch (error) {
			return { command: "", warnings: [] as string[], image: "", error: error instanceof Error ? error.message : "Could not convert this Compose file." };
		}
	}, [source, service, detach, rm]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="compose-service">
					Service
					<select className={selectClassName} id="compose-service" onChange={(event) => setService(event.target.value)} value={names.includes(service) ? service : names[0] ?? ""}>
						{names.length === 0 ? <option value="">No services detected</option> : null}
						{names.map((name) => (
							<option key={name} value={name}>
								{name}
							</option>
						))}
					</select>
				</label>
				<div className="flex flex-col justify-end gap-2">
					<CheckboxField checked={detach} id="compose-detach" label={<>Run detached (<code>-d</code>)</>} onChange={setDetach} />
					<CheckboxField checked={rm} id="compose-rm" label={<>Remove the container when it exits (<code>--rm</code>)</>} onChange={setRm} />
				</div>
			</div>
			<TextAreaField
				id="compose-source"
				label="docker-compose.yml"
				value={source}
				onChange={setSource}
				placeholder={"services:\n  web:\n    image: nginx:alpine"}
				rows={14}
				hint="Ports, volumes (short and long syntax), environment maps, networks, labels, capabilities, and deploy resource limits become docker run flags."
			/>
			<ErrorNote message={result.error} />
			{result.warnings.length > 0 && (
				<ul className="m-0 flex list-none flex-col gap-1 border border-[#e4d9bd] bg-[#fdf8ec] px-4 py-3 text-xs text-[#6f5718]">
					{result.warnings.map((warning) => (
						<li key={warning}>{warning}</li>
					))}
				</ul>
			)}
			{result.command && <ResultBlock title="$ docker run" value={result.command} rows={6} fileName="run.sh" />}
			<p className={hintClassName}>
				Compose-only features such as build contexts, healthchecks, and depends_on are listed as warnings instead of being silently dropped. Use this
				to debug a single service outside Compose.
			</p>
		</ToolPanel>
	);
};
