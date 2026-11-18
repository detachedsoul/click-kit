export type ComposeService = {
	image: string;
	command: string[];
	ports: string[];
	volumes: string[];
	environment: string[];
	labels: string[];
	tmpfs: string[];
	capAdd: string[];
	capDrop: string[];
	name?: string;
	restart?: string;
	network?: string;
	networkMode?: string;
	workingDir?: string;
	user?: string;
	hostname?: string;
	entrypoint?: string;
	memory?: string;
	cpus?: string;
	privileged?: boolean;
	init?: boolean;
	readOnly?: boolean;
};

export type DockerRunParse = { service: ComposeService; warnings: string[] };

const tokenise = (command: string) => {
	const tokens: string[] = [];
	let current = "";
	let quote: string | null = null;
	const normalised = command.replace(/\\\r?\n/gu, " ");
	for (let index = 0; index < normalised.length; index += 1) {
		const character = normalised[index];
		if (quote) {
			if (character === quote) quote = null;
			else current += character;
			continue;
		}
		if (character === "'" || character === '"') {
			quote = character;
			continue;
		}
		if (/\s/u.test(character)) {
			if (current) tokens.push(current);
			current = "";
			continue;
		}
		current += character;
	}
	if (quote) throw new Error(`Unclosed ${quote} quote in the docker run command.`);
	if (current) tokens.push(current);
	return tokens;
};

const splitPair = (value: string, separator: string) => {
	const index = value.indexOf(separator);
	if (index < 0) return null;
	return [value.slice(0, index), value.slice(index + separator.length)] as const;
};

export const parseDockerRun = (command: string): DockerRunParse => {
	const trimmed = command.trim();
	if (!trimmed) throw new Error("Paste a docker run command first.");
	if (!/docker\s+(container\s+)?run\b/u.test(trimmed)) throw new Error('The command should start with "docker run" (or "docker container run").');
	const tokens = tokenise(trimmed);
	const start = tokens.findIndex((token) => token === "run");
	const service: ComposeService = {
		image: "",
		command: [],
		ports: [],
		volumes: [],
		environment: [],
		labels: [],
		tmpfs: [],
		capAdd: [],
		capDrop: [],
	};
	const warnings: string[] = [];
	let init = false;
	let readOnly = false;
	for (let index = start + 1; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (!token.startsWith("-")) {
			service.image = token;
			service.command = tokens.slice(index + 1);
			break;
		}
		const takeValue = () => {
			const next = tokens[index + 1];
			if (next === undefined || (next.startsWith("-") && next.length > 1)) throw new Error(`Flag ${flagName} needs a value.`);
			index += 1;
			return next;
		};
		const flagValue = splitPair(token, "=");
		const flagName = flagValue ? flagValue[0] : token;
		const value = () => (flagValue ? flagValue[1] : takeValue());
		switch (flagName) {
			case "-d":
			case "--detach":
			case "-i":
			case "--interactive":
			case "-t":
			case "--tty":
			case "--rm":
			case "-it":
			case "-ti":
				break;
			case "-p":
			case "--publish":
				service.ports.push(value());
				break;
			case "-v":
			case "--volume":
				service.volumes.push(value());
				break;
			case "--mount": {
				const mount = value();
				const parts = mount.split(",");
				const source = parts.find((part) => part.startsWith("source=") || part.startsWith("src="))?.split("=")[1];
				const target = parts.find((part) => part.startsWith("target=") || part.startsWith("dst=") || part.startsWith("destination="))?.split("=")[1];
				if (!target) throw new Error("--mount needs a target= path.");
				service.volumes.push(source ? `${source}:${target}` : target);
				if (parts.includes("readonly") || parts.includes("ro")) service.volumes[service.volumes.length - 1] = `${service.volumes[service.volumes.length - 1]}:ro`;
				break;
			}
			case "-e":
			case "--env":
				service.environment.push(value());
				break;
			case "--env-file":
				warnings.push(`--env-file ${value()} is not inlined; add an env_file entry pointing at it.`);
				break;
			case "--name":
				service.name = value();
				break;
			case "--restart":
				service.restart = value();
				break;
			case "--network":
			case "--net":
				service.networkMode = value();
				break;
			case "-w":
			case "--workdir":
				service.workingDir = value();
				break;
			case "-u":
			case "--user":
				service.user = value();
				break;
			case "-h":
			case "--hostname":
				service.hostname = value();
				break;
			case "--entrypoint":
				service.entrypoint = value();
				break;
			case "--label":
			case "-l":
				service.labels.push(value());
				break;
			case "--tmpfs":
				service.tmpfs.push(value());
				break;
			case "--cap-add":
				service.capAdd.push(value());
				break;
			case "--cap-drop":
				service.capDrop.push(value());
				break;
			case "--memory":
			case "-m":
				service.memory = value();
				break;
			case "--cpus":
				service.cpus = value();
				break;
			case "--privileged":
				service.privileged = true;
				break;
			case "--init":
				init = true;
				break;
			case "--read-only":
				readOnly = true;
				break;
			case "--platform":
			case "--pull":
				warnings.push(`${flagName} ${flagValue ? flagValue[1] : takeValue()} has no Compose equivalent and was dropped.`);
				break;
			default:
				warnings.push(`${flagName} is not translated by this converter and was dropped.`);
				if (!flagValue && tokens[index + 1] && !tokens[index + 1].startsWith("-")) index += 1;
		}
	}
	if (!service.image) throw new Error("No image name found in the command.");
	if (init) service.init = true;
	if (readOnly) service.readOnly = true;
	return { service, warnings };
};

const quote = (value: string) => (/^[\w@%+=:,./-]+$/u.test(value) ? value : JSON.stringify(value));

export const toCompose = ({ service, warnings }: DockerRunParse) => {
	const name = service.name ?? service.image.split("/").pop()?.split(":")[0]?.replace(/[^a-zA-Z0-9_.-]/gu, "-") ?? "app";
	const lines: string[] = ["services:", `  ${name}:`, `    image: ${quote(service.image)}`];
	if (service.name) lines.push(`    container_name: ${quote(service.name)}`);
	if (service.restart) lines.push(`    restart: ${quote(service.restart)}`);
	if (service.networkMode) {
		if (service.networkMode === "host" || service.networkMode === "none") lines.push(`    network_mode: ${service.networkMode}`);
		else lines.push(`    networks:\n      - ${quote(service.networkMode)}`);
	}
	if (service.ports.length) {
		lines.push("    ports:");
		for (const port of service.ports) {
			lines.push(`      - "${port}"`);
		}
	}
	if (service.volumes.length) {
		lines.push("    volumes:");
		for (const volume of service.volumes) lines.push(`      - ${quote(volume)}`);
	}
	if (service.environment.length) {
		lines.push("    environment:");
		for (const entry of service.environment) lines.push(`      - ${quote(entry)}`);
	}
	if (service.labels.length) {
		lines.push("    labels:");
		for (const label of service.labels) lines.push(`      - ${quote(label)}`);
	}
	if (service.tmpfs.length) {
		lines.push("    tmpfs:");
		for (const item of service.tmpfs) lines.push(`      - ${quote(item)}`);
	}
	if (service.capAdd.length) {
		lines.push("    cap_add:");
		for (const item of service.capAdd) lines.push(`      - ${quote(item)}`);
	}
	if (service.capDrop.length) {
		lines.push("    cap_drop:");
		for (const item of service.capDrop) lines.push(`      - ${quote(item)}`);
	}
	if (service.workingDir) lines.push(`    working_dir: ${quote(service.workingDir)}`);
	if (service.user) lines.push(`    user: ${quote(service.user)}`);
	if (service.hostname) lines.push(`    hostname: ${quote(service.hostname)}`);
	if (service.entrypoint) lines.push(`    entrypoint: ${quote(service.entrypoint)}`);
	if (service.privileged) lines.push("    privileged: true");
	if (service.readOnly) lines.push("    read_only: true");
	if (service.init) lines.push("    init: true");
	if (service.memory || service.cpus) {
		lines.push("    deploy:", "      resources:", "        limits:");
		if (service.cpus) lines.push(`          cpus: "${service.cpus}"`);
		if (service.memory) lines.push(`          memory: ${quote(service.memory)}`);
	}
	if (service.command.length) {
		lines.push("    command:");
		for (const item of service.command) lines.push(`      - ${quote(item)}`);
	}
	const footer = warnings.length ? `\n# Review before running:\n${warnings.map((warning) => `# - ${warning}`).join("\n")}\n` : "\n";
	return `# Generated by ClickKit from a docker run command\n${lines.join("\n")}\n${footer}`;
};
