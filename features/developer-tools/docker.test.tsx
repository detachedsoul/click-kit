import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { parseDockerRun, toCompose } from "@/features/developer-tools/docker-utils";
import { DockerTool } from "@/features/developer-tools/docker-tool";

afterEach(cleanup);

describe("docker run to compose converter", () => {
	it("parses the common flags", () => {
		const { service } = parseDockerRun(
			'docker run -d --name api --restart=always -p 8080:80 -v /data:/data:ro -e A=1 --env DAYS="two days" --label tier=web nginx:1.27 nginx -g "daemon off;"',
		);
		expect(service.image).toBe("nginx:1.27");
		expect(service.name).toBe("api");
		expect(service.restart).toBe("always");
		expect(service.ports).toEqual(["8080:80"]);
		expect(service.volumes).toEqual(["/data:/data:ro"]);
		expect(service.environment).toEqual(["A=1", "DAYS=two days"]);
		expect(service.labels).toEqual(["tier=web"]);
		expect(service.command).toEqual(["nginx", "-g", "daemon off;"]);
	});

	it("handles line continuations, mounts, and resource limits", () => {
		const { service } = parseDockerRun(
			"docker run \\\n  --mount type=bind,source=/tmp/cache,target=/cache,readonly \\\n  -m 1g --cpus 0.5 --network frontend --cap-add NET_ADMIN --privileged my/app:latest",
		);
		expect(service.volumes).toEqual(["/tmp/cache:/cache:ro"]);
		expect(service.memory).toBe("1g");
		expect(service.cpus).toBe("0.5");
		expect(service.networkMode).toBe("frontend");
		expect(service.capAdd).toEqual(["NET_ADMIN"]);
		expect(service.privileged).toBe(true);
	});

	it("warns about untranslated flags", () => {
		const { warnings } = parseDockerRun("docker run --platform linux/arm64 --runtime nvidia alpine");
		expect(warnings.some((warning) => warning.includes("--platform"))).toBe(true);
		expect(warnings.some((warning) => warning.includes("--runtime"))).toBe(true);
	});

	it("rejects malformed commands", () => {
		expect(() => parseDockerRun("")).toThrow(/Paste a docker run/u);
		expect(() => parseDockerRun("docker ps")).toThrow(/start with "docker run"/u);
		expect(() => parseDockerRun("docker run -p")).toThrow(/needs a value/u);
		expect(() => parseDockerRun("docker run --name 'oops alpine")).toThrow(/Unclosed/u);
		expect(() => parseDockerRun("docker run -d --name only")).toThrow(/No image name/u);
		expect(() => parseDockerRun("docker run --mount type=bind,source=/a alpine")).toThrow(/target=/u);
	});

	it("renders compose YAML", () => {
		const yaml = toCompose(parseDockerRun("docker run -d -p 80:80 --name web nginx:alpine"));
		expect(yaml).toContain("services:\n  web:\n    image: nginx:alpine");
		expect(yaml).toContain('container_name: web');
		expect(yaml).toContain('      - "80:80"');
		render(<DockerTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("image: ghcr.io/acme/api:1.4.2");
		fireEvent.change(screen.getByLabelText("docker run command"), { target: { value: "docker run nginx" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("image: nginx");
		fireEvent.change(screen.getByLabelText("docker run command"), { target: { value: "nope" } });
		expect(screen.getByText(/start with "docker run"/u)).toBeTruthy();
	});
});
