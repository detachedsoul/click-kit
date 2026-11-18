import { parse as parseYaml } from "yaml";

export type ComposeServiceNames = { names: string[]; warnings: string[] };

type ComposeMapping = Record<string, unknown>;

const isMapping = (value: unknown): value is ComposeMapping => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => {
	if (Array.isArray(value)) return value;
	if (isMapping(value)) return Object.entries(value).map(([key, item]) => (item === null || item === undefined ? key : `${key}=${String(item)}`));
	if (typeof value === "string") return [value];
	return [];
};

const shellArg = (value: string) => (/^[\w@%+=:,./-]+$/u.test(value) ? value : `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`);

const portArgs = (value: unknown) => {
	if (typeof value === "string" || typeof value === "number") return [String(value)];
	if (!isMapping(value)) return [];
	const target = value.target ?? value.container_port;
	const published = value.published ?? value.host_port;
	const protocol = value.protocol ? `/${String(value.protocol)}` : "";
	if (target === undefined) return [];
	return [published !== undefined ? `${String(published)}:${String(target)}${protocol}` : `${String(target)}${protocol}`];
};

const volumeArgs = (value: unknown) => {
	if (typeof value === "string") return [value];
	if (!isMapping(value)) return [];
	const type = value.type ? `type=${String(value.type)},` : "";
	const source = value.source ? `source=${String(value.source)},` : "";
	const target = value.target ? `target=${String(value.target)}` : "";
	const readOnly = value.read_only ? ",readonly" : "";
	return [`--mount ${type}${source}${target}${readOnly}`];
};

export const composeServiceNames = (source: string): ComposeServiceNames => {
	if (!source.trim()) throw new Error("Paste a docker-compose.yml first.");
	let parsed: unknown;
	try {
		parsed = parseYaml(source);
	} catch (error) {
		throw new Error(`Invalid YAML: ${error instanceof Error ? error.message.split("\n")[0] : "could not parse"}`);
	}
	if (!isMapping(parsed) || !isMapping(parsed.services)) throw new Error("No services: block found in this Compose file.");
	const names = Object.keys(parsed.services);
	if (names.length === 0) throw new Error("The services block is empty.");
	const warnings = Array.isArray(parsed.services) ? [] : [];
	return { names, warnings };
};

export type ComposeRunOptions = { service: string; detach: boolean; rm: boolean };

export type ComposeRunResult = { command: string; warnings: string[]; image: string };

export const composeToRun = (source: string, options: ComposeRunOptions): ComposeRunResult => {
	const { names } = composeServiceNames(source);
	const parsed = parseYaml(source) as ComposeMapping;
	const services = parsed.services as Record<string, unknown>;
	const serviceName = options.service && names.includes(options.service) ? options.service : names[0];
	if (!isMapping(services[serviceName])) throw new Error(`Service "${serviceName}" is not a mapping of keys.`);
	const service = services[serviceName] as ComposeMapping;
	const warnings: string[] = [];
	const args: string[] = [];
	const add = (flag: string, value: string) => args.push(flag, shellArg(value));
	if (options.detach) args.push("-d");
	if (options.rm) args.push("--rm");
	if (service.container_name) add("--name", String(service.container_name));
	if (service.restart) add("--restart", String(service.restart));
	if (service.network_mode) add("--network", String(service.network_mode));
	for (const network of asArray(service.networks)) add("--network", String(network));
	for (const port of asArray(service.ports)) for (const entry of portArgs(port)) add("-p", entry);
	for (const volume of asArray(service.volumes)) for (const entry of volumeArgs(volume)) {
		if (entry.startsWith("--mount ")) args.push("--mount", shellArg(entry.slice(8)));
		else add("-v", entry);
	}
	for (const entry of asArray(service.environment)) {
		const text = String(entry);
		if (text.includes("=")) add("-e", text);
		else add("-e", text);
	}
	for (const label of asArray(service.labels)) add("--label", typeof label === "string" ? label : JSON.stringify(label));
	for (const tmpfs of asArray(service.tmpfs)) add("--tmpfs", String(tmpfs));
	for (const capability of asArray(service.cap_add)) add("--cap-add", String(capability));
	for (const capability of asArray(service.cap_drop)) add("--cap-drop", String(capability));
	if (service.working_dir) add("-w", String(service.working_dir));
	if (service.user) add("-u", String(service.user));
	if (service.hostname) add("-H", String(service.hostname));
	if (service.entrypoint !== undefined) {
		const entrypoint = Array.isArray(service.entrypoint) ? service.entrypoint.map(String).join(" ") : String(service.entrypoint);
		add("--entrypoint", entrypoint);
	}
	if (service.privileged === true) args.push("--privileged");
	if (service.read_only === true) args.push("--read-only");
	if (service.init === true) args.push("--init");
	const deploy = isMapping(service.deploy) ? service.deploy : {};
	const limits = isMapping(deploy.resources) && isMapping((deploy.resources as ComposeMapping).limits) ? ((deploy.resources as ComposeMapping).limits as ComposeMapping) : {};
	if (limits.memory) add("--memory", String(limits.memory));
	if (limits.cpus) add("--cpus", String(limits.cpus));
	if (service.build) warnings.push("This service is built from source; the image tag is unknown until you run docker compose build.");
	if (service.depends_on) warnings.push("depends_on is not translated: start dependencies with docker compose or plain docker run.");
	if (service.healthcheck) warnings.push("healthcheck has no single docker run flag; translate it by hand if you need it.");
	if (isMapping(deploy) && deploy.replicas) warnings.push(`deploy.replicas is ${String(deploy.replicas)}; run the command that many times behind a load balancer.`);
	if (service.env_file) warnings.push("env_file is not inlined; pass --env-file with the same path.");
	if (service.image === undefined && !service.build) throw new Error(`Service "${serviceName}" has neither an image nor a build section.`);
	const image = service.image ? String(service.image) : `${serviceName}:latest`;
	let command = "";
	if (service.command !== undefined) {
		const parts = Array.isArray(service.command)
			? service.command.map((part) => String(part))
			: String(service.command).trim().split(/\s+/u).filter(Boolean);
		command = ` ${parts.map(shellArg).join(" ")}`;
	}
	return { command: `docker run ${args.join(" ")} ${shellArg(image)}${command}`.replace(/\s+/gu, " ").trim(), warnings, image };
};
