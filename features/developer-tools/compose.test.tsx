import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { composeServiceNames, composeToRun } from "@/features/developer-tools/compose-utils";
import { ComposeTool } from "@/features/developer-tools/compose-tool";

afterEach(cleanup);

const compose = `services:
  web:
    image: nginx:1.27
    container_name: web
    restart: always
    ports:
      - "8080:80"
      - target: 443
        published: 8443
        protocol: tcp
    volumes:
      - ./site:/usr/share/nginx/html:ro
      - type: bind
        source: ./conf
        target: /etc/nginx/conf.d
        read_only: true
    environment:
      TZ: UTC
      DEBUG: "false"
    labels:
      tier: frontend
    networks:
      - frontend
  worker:
    build: .
    command: node worker.js
    depends_on:
      - web`;

describe("compose to docker run", () => {
	it("lists services and validates the file", () => {
		expect(composeServiceNames(compose).names).toEqual(["web", "worker"]);
		expect(() => composeServiceNames("   ")).toThrow(/Paste a docker-compose.yml/u);
		expect(() => composeServiceNames("version: '3'")).toThrow(/No services/u);
		expect(() => composeServiceNames("services: [")).toThrow(/Invalid YAML/u);
	});

	it("converts the common keys into flags", () => {
		const { command } = composeToRun(compose, { service: "web", detach: true, rm: false });
		expect(command).toContain("docker run -d");
		expect(command).toContain("--name web");
		expect(command).toContain("--restart always");
		expect(command).toContain("-p 8080:80");
		expect(command).toContain("-p 8443:443/tcp");
		expect(command).toContain("-v ./site:/usr/share/nginx/html:ro");
		expect(command).toContain("--mount type=bind,source=./conf,target=/etc/nginx/conf.d,readonly");
		expect(command).toContain("-e TZ=UTC");
		expect(command).toContain("-e DEBUG=false");
		expect(command).toContain("--label tier=frontend");
		expect(command).toContain("--network frontend");
		expect(command.trim().endsWith("nginx:1.27")).toBe(true);
	});

	it("warns about Compose-only features and adds commands", () => {
		const result = composeToRun(compose, { service: "worker", detach: true, rm: true });
		expect(result.command).toContain("--rm");
		expect(result.command).toContain("worker:latest node worker.js");
		expect(result.warnings.join(" ")).toContain("built from source");
		expect(result.warnings.join(" ")).toContain("depends_on");
		expect(() => composeToRun("services:\n  x:\n    restart: always", { service: "x", detach: false, rm: false })).toThrow(/neither an image nor a build/u);
	});

	it("quotes values with spaces", () => {
		const result = composeToRun('services:\n  app:\n    image: alpine\n    command: ["sh", "-c", "echo hello world"]', { service: "app", detach: false, rm: false });
		expect(result.command).toContain('"echo hello world"');
	});

	it("renders the command and reacts to options", async () => {
		const user = userEvent.setup();
		render(<ComposeTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("--name api");
		expect(output()).toContain("--memory 512m");
		expect(output()).toContain("node server.js --port 8080");
		await user.selectOptions(screen.getByLabelText("Service"), "worker");
		expect(output()).toContain("ghcr.io/acme/worker:1.4.2");
		fireEvent.click(screen.getByLabelText("Remove the container when it exits (--rm)"));
		expect(output()).toContain("--rm");
		fireEvent.change(screen.getByLabelText("docker-compose.yml"), { target: { value: "nope: true" } });
		expect(screen.getByRole("alert").textContent).toContain("No services");
	});
});
