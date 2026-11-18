import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChmodTool } from "@/features/developer-tools/chmod-tool";
import { permissionsFromBits, permissionsFromOctal, permissionsFromSymbolic } from "@/features/developer-tools/chmod-utils";

afterEach(cleanup);

describe("chmod calculator", () => {
	it("converts common octal modes to symbolic form", () => {
		expect(permissionsFromOctal("755")).toMatchObject({ octal: "755", symbolic: "rwxr-xr-x", command: "chmod 755 path/to/file" });
		expect(permissionsFromOctal("644")).toMatchObject({ octal: "644", symbolic: "rw-r--r--" });
		expect(permissionsFromOctal("000")).toMatchObject({ symbolic: "---------" });
		expect(permissionsFromOctal("600")).toMatchObject({ symbolic: "rw-------" });
	});

	it("renders special bits", () => {
		expect(permissionsFromOctal("4755")).toMatchObject({ symbolic: "rwsr-xr-x" });
		expect(permissionsFromOctal("1777")).toMatchObject({ symbolic: "rwxrwxrwt" });
		expect(permissionsFromOctal("2755")).toMatchObject({ symbolic: "rwxr-sr-x" });
		expect(permissionsFromOctal("4644").symbolic).toBe("rwSr--r--");
	});

	it("describes each class of access", () => {
		expect(permissionsFromOctal("754").summary).toEqual(["Owner: read, write, execute", "Group: read, execute", "Others: read"]);
		expect(permissionsFromOctal("000").summary[0]).toBe("Owner: no access");
		expect(permissionsFromOctal("1777").summary.at(-1)).toContain("Sticky");
	});

	it("parses symbolic modes and rebuilds octal", () => {
		expect(permissionsFromSymbolic("rwxr-xr-x")).toMatchObject({ octal: "755" });
		expect(permissionsFromSymbolic("rw-r--r--")).toMatchObject({ octal: "644" });
		expect(permissionsFromSymbolic("rwsr-xr-x")).toMatchObject({ octal: "4755", special: { setuid: true } });
		expect(permissionsFromSymbolic("rwxrwxrwt")).toMatchObject({ octal: "1777", special: { sticky: true } });
		expect(permissionsFromSymbolic("rwxrwxrwx")).toMatchObject({ octal: "777", user: { read: true, write: true, execute: true } });
	});

	it("builds permissions from toggled bits", () => {
		expect(permissionsFromBits({ read: true, write: true, execute: false }, { read: true, write: false, execute: false }, { read: false, write: false, execute: false }, { setuid: false, setgid: false, sticky: false })).toMatchObject({
			octal: "640",
			symbolic: "rw-r-----",
		});
	});

	it("rejects malformed modes", () => {
		expect(() => permissionsFromOctal("")).toThrow(/Enter an octal mode/u);
		expect(() => permissionsFromOctal("888")).toThrow(/digits from 0 to 7/u);
		expect(() => permissionsFromOctal("75")).toThrow(/three or four digits/u);
		expect(() => permissionsFromSymbolic("rwx")).toThrow(/three characters per class/u);
	});

	it("updates the command when toggling a bit", () => {
		render(<ChmodTool />);
		expect((screen.getAllByLabelText("Result")[0] as HTMLTextAreaElement).value).toBe("chmod 755 path/to/file");
		fireEvent.click(screen.getAllByLabelText(/^write/u)[2]);
		expect((screen.getAllByLabelText("Result")[0] as HTMLTextAreaElement).value).toBe("chmod 757 path/to/file");
		fireEvent.change(screen.getByLabelText("Octal mode"), { target: { value: "4755" } });
		expect((screen.getAllByLabelText("Result")[0] as HTMLTextAreaElement).value).toBe("chmod 4755 path/to/file");
		expect(screen.getByText(/Setuid/u)).toBeTruthy();
	});

	it("decodes symbolic input and reports errors", () => {
		render(<ChmodTool />);
		fireEvent.change(screen.getByLabelText("Decode a symbolic mode"), { target: { value: "rw-r--r--" } });
		expect(screen.getByText(/rw-r--r-- = 644/u)).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Decode a symbolic mode"), { target: { value: "rw" } });
		expect(screen.getByRole("alert").textContent).toContain("three characters per class");
	});
});
