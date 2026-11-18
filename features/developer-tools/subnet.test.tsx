import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SubnetTool } from "@/features/developer-tools/subnet-tool";
import { calculateSubnet, splitIntoSubnets } from "@/features/developer-tools/subnet-utils";

afterEach(cleanup);

describe("subnet calculator", () => {
	it("calculates an IPv4 /24 block", () => {
		expect(calculateSubnet("192.168.1.10/24")).toMatchObject({
			version: "IPv4",
			network: "192.168.1.0",
			broadcast: "192.168.1.255",
			netmask: "255.255.255.0",
			wildcard: "0.0.0.255",
			firstHost: "192.168.1.1",
			lastHost: "192.168.1.254",
			usableHosts: "254",
			totalAddresses: "256",
			scope: "Private (RFC 1918)",
			addressClass: "Class C",
			reverseDns: "1.168.192.in-addr.arpa",
			binaryNetwork: "11000000.10101000.00000001.00000000",
		});
	});

	it("handles /31, /32, and bare addresses", () => {
		expect(calculateSubnet("10.0.0.0/31")).toMatchObject({ usableHosts: "2", firstHost: "10.0.0.0", lastHost: "10.0.0.1" });
		expect(calculateSubnet("10.0.0.5")).toMatchObject({ cidr: "10.0.0.5/32", network: "10.0.0.5", usableHosts: "1" });
		expect(calculateSubnet("0.0.0.0/0")).toMatchObject({ netmask: "0.0.0.0", totalAddresses: "4,294,967,296" });
	});

	it("recognises public, loopback, and link-local ranges", () => {
		expect(calculateSubnet("8.8.8.8/32")).toMatchObject({ scope: "Public" });
		expect(calculateSubnet("127.0.0.1")).toMatchObject({ scope: "Loopback" });
		expect(calculateSubnet("169.254.10.1/16")).toMatchObject({ scope: "Link-local" });
		expect(calculateSubnet("100.64.0.1/10")).toMatchObject({ scope: "Carrier-grade NAT" });
	});

	it("normalises IPv6 input", () => {
		expect(calculateSubnet("2001:db8::1/32")).toMatchObject({
			version: "IPv6",
			network: "2001:db8::",
			prefix: 32,
			scope: "Global unicast",
		});
		expect(calculateSubnet("fe80::1/64").scope).toBe("Link-local");
		expect(calculateSubnet("::1").network).toBe("::1");
	});

	it("splits a block into smaller subnets", () => {
		const split = splitIntoSubnets("192.168.0.0/24", 26);
		expect(split.count).toBe(4);
		expect(split.listed.map((item) => item.cidr)).toEqual(["192.168.0.0/26", "192.168.0.64/26", "192.168.0.128/26", "192.168.0.192/26"]);
		expect(split.listed[1].range).toBe("192.168.0.64 – 192.168.0.127");
	});

	it("rejects malformed addresses, prefixes, and impossible splits", () => {
		expect(() => calculateSubnet("  ")).toThrow(/Enter an IP address/u);
		expect(() => calculateSubnet("192.168.1")).toThrow(/not a valid IPv4/u);
		expect(() => calculateSubnet("300.1.1.1")).toThrow(/above 255/u);
		expect(() => calculateSubnet("10.0.0.0/33")).toThrow(/run from 0 to 32/u);
		expect(() => calculateSubnet("10.0.0.0/8/8")).toThrow(/single \/ prefix/u);
		expect(() => calculateSubnet("2001:db8:::1")).toThrow(/not a valid IPv6/u);
		expect(() => splitIntoSubnets("10.0.0.0/24", 24)).toThrow(/longer than \/24/u);
		expect(() => splitIntoSubnets("2001:db8::/32", 48)).toThrow(/IPv4 only/u);
	});

	it("renders network details and updates on input", () => {
		render(<SubnetTool />);
		expect(screen.getByText("192.168.1.0")).toBeTruthy();
		fireEvent.change(screen.getByLabelText("IP address or CIDR block"), { target: { value: "10.1.2.3/12" } });
		expect(screen.getByText("10.0.0.0")).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Split into /prefix"), { target: { value: "14" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("10.0.0.0/14");
	});

	it("shows an alert for invalid input", () => {
		render(<SubnetTool />);
		fireEvent.change(screen.getByLabelText("IP address or CIDR block"), { target: { value: "nope" } });
		expect(screen.getByRole("alert").textContent).toContain("not a valid IPv4");
	});
});
