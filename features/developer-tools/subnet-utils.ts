const maximumCidrLength = 60;
const maximumListedSubnets = 64;

const parseIpv4 = (value: string) => {
	if (!/^\d{1,3}(\.\d{1,3}){3}$/u.test(value)) throw new Error(`"${value}" is not a valid IPv4 address.`);
	const octets = value.split(".").map(Number);
	if (octets.some((octet) => octet > 255)) throw new Error(`"${value}" has an octet above 255.`);
	return octets;
};

const ipv4ToNumber = (octets: number[]) => octets.reduce((total, octet) => total * 256 + octet, 0);

const numberToIpv4 = (value: number) => [24, 16, 8, 0].map((shift) => Math.floor((value >>> 0) / 2 ** shift) % 256).join(".");

const parseIpv6 = (value: string) => {
	if (!/^[0-9a-fA-F:]+$/u.test(value) || value.split(":").length < 3 || value.split(":").length > 9) {
		throw new Error(`"${value}" is not a valid IPv6 address.`);
	}
	const [head, tail] = value.includes("::") ? value.split("::") : [value, undefined];
	const headGroups = head ? head.split(":") : [];
	const tailGroups = tail ? tail.split(":") : [];
	const groups = tail === undefined ? headGroups : [...headGroups, ...Array(8 - headGroups.length - tailGroups.length).fill("0"), ...tailGroups];
	if (groups.length !== 8 || groups.some((group) => !/^[0-9a-fA-F]{1,4}$/u.test(group))) {
		throw new Error(`"${value}" is not a valid IPv6 address.`);
	}
	return groups.map((group) => Number.parseInt(group, 16));
};

const ipv6ToNumber = (groups: number[]) => groups.reduce((total, group) => (total << BigInt(16)) + BigInt(group), BigInt(0));

const numberToIpv6Groups = (value: bigint) => Array.from({ length: 8 }, (_, index) => Number((value >> BigInt(16 * (7 - index))) & BigInt(0xffff)));

const compressIpv6 = (groups: number[]) => {
	const hex = groups.map((group) => group.toString(16));
	let bestStart = -1;
	let bestLength = 0;
	for (let index = 0; index < hex.length; index += 1) {
		if (hex[index] !== "0") continue;
		let end = index;
		while (end < hex.length && hex[end] === "0") end += 1;
		if (end - index > bestLength && end - index > 1) {
			bestStart = index;
			bestLength = end - index;
		}
		index = end;
	}
	if (bestStart === -1) return hex.join(":");
	return `${hex.slice(0, bestStart).join(":")}::${hex.slice(bestStart + bestLength).join(":")}`.replace(/^:/u, "::").replace(/:$/u, "::").replace(/:::/u, "::");
};

const describeScope = (version: 4 | 6, address: number | bigint) => {
	if (version === 6) {
		const value = address as bigint;
		if (value === BigInt(0)) return "Unspecified";
		if (value === BigInt(1)) return "Loopback";
		if (value >> BigInt(120) === BigInt(0xfe)) return "Link-local";
		if (value >> BigInt(121) === BigInt(0x7e)) return "Unique local";
		if (value >> BigInt(120) === BigInt(0xff)) return "Multicast";
		return "Global unicast";
	}
	const value = address as number;
	if (value >>> 24 === 127) return "Loopback";
	if (value >>> 24 === 10) return "Private (RFC 1918)";
	if (value >>> 20 === 0xac1) return "Private (RFC 1918)";
	if (value >>> 16 === 0xc0a8) return "Private (RFC 1918)";
	if (value >>> 16 === 0xa9fe) return "Link-local";
	if (value >>> 22 === 0x191) return "Carrier-grade NAT";
	if (value >>> 24 === 0) return "This network";
	if (value >>> 28 === 0xe) return "Multicast";
	if (value >>> 28 === 0xf) return "Reserved";
	if (value >>> 24 >= 224) return "Multicast or reserved";
	return "Public";
};

const reverseZone = (network: string, prefix: number) => {
	const octets = Math.ceil(prefix / 8);
	if (octets === 0) return "in-addr.arpa";
	return `${network.split(".").slice(0, octets).reverse().join(".")}.in-addr.arpa`;
};

const ipv4Class = (octets: number[]) => {
	const first = octets[0];
	if (first < 128) return "Class A";
	if (first < 192) return "Class B";
	if (first < 224) return "Class C";
	if (first < 240) return "Class D (multicast)";
	return "Class E (reserved)";
};

export type Ipv4Subnet = {
	version: "IPv4";
	cidr: string;
	prefix: number;
	network: string;
	broadcast: string;
	netmask: string;
	wildcard: string;
	firstHost: string;
	lastHost: string;
	totalAddresses: string;
	usableHosts: string;
	scope: string;
	addressClass: string;
	binaryNetwork: string;
	reverseDns: string;
};

export type Ipv6Subnet = {
	version: "IPv6";
	cidr: string;
	prefix: number;
	network: string;
	expanded: string;
	totalAddresses: string;
	scope: string;
};

export type SubnetResult = Ipv4Subnet | Ipv6Subnet;

const splitInput = (source: string) => {
	const trimmed = source.trim();
	if (!trimmed) throw new Error("Enter an IP address or CIDR block.");
	if (trimmed.length > maximumCidrLength) throw new Error("That address is too long to parse.");
	const slash = trimmed.indexOf("/");
	if (slash === -1) return { address: trimmed, prefix: undefined };
	if (trimmed.indexOf("/", slash + 1) !== -1) throw new Error("Use a single / prefix, for example 10.0.0.0/8.");
	const prefixText = trimmed.slice(slash + 1);
	if (!/^\d{1,3}$/u.test(prefixText)) throw new Error(`"${prefixText}" is not a valid prefix length.`);
	return { address: trimmed.slice(0, slash), prefix: Number(prefixText) };
};

export const calculateSubnet = (source: string): SubnetResult => {
	const { address, prefix } = splitInput(source);
	if (address.includes(":")) {
		const groups = parseIpv6(address);
		const prefixLength = prefix ?? 128;
		if (prefixLength > 128) throw new Error("IPv6 prefixes run from 0 to 128.");
		const value = ipv6ToNumber(groups);
		const hostBits = BigInt(128 - prefixLength);
		const allOnes = (BigInt(1) << BigInt(128)) - BigInt(1);
		const mask = hostBits === BigInt(0) ? allOnes : allOnes ^ ((BigInt(1) << hostBits) - BigInt(1));
		const network = value & mask;
		return {
			version: "IPv6",
			cidr: `${compressIpv6(groups)}/${prefixLength}`,
			prefix: prefixLength,
			network: compressIpv6(numberToIpv6Groups(network)),
			expanded: groups.map((group) => group.toString(16).padStart(4, "0")).join(":"),
			totalAddresses: (BigInt(1) << hostBits).toLocaleString("en-US"),
			scope: describeScope(6, value),
		};
	}
	const octets = parseIpv4(address);
	const prefixLength = prefix ?? 32;
	if (prefixLength > 32) throw new Error("IPv4 prefixes run from 0 to 32.");
	const hostBits = 32 - prefixLength;
	const hostMask = hostBits === 0 ? 0 : 2 ** hostBits - 1;
	const value = ipv4ToNumber(octets);
	const network = (value & ~hostMask) >>> 0;
	const broadcast = (network + hostMask) >>> 0;
	const total = 2 ** hostBits;
	const usable = hostBits >= 2 ? total - 2 : total;
	const netmask = numberToIpv4((~hostMask) >>> 0);
	return {
		version: "IPv4",
		cidr: `${numberToIpv4(value)}/${prefixLength}`,
		prefix: prefixLength,
		network: numberToIpv4(network),
		broadcast: numberToIpv4(broadcast),
		netmask,
		wildcard: numberToIpv4(hostMask),
		firstHost: numberToIpv4(hostBits >= 2 ? network + 1 : network),
		lastHost: numberToIpv4(hostBits >= 2 ? broadcast - 1 : broadcast),
		totalAddresses: total.toLocaleString("en-US"),
		usableHosts: usable.toLocaleString("en-US"),
		scope: describeScope(4, value),
		addressClass: ipv4Class(octets),
		binaryNetwork: network
			.toString(2)
			.padStart(32, "0")
			.match(/.{8}/gu)!
			.join("."),
		reverseDns: reverseZone(numberToIpv4(network), prefixLength),
	};
};

export const splitIntoSubnets = (source: string, newPrefix: number) => {
	const { address, prefix } = splitInput(source);
	if (address.includes(":")) throw new Error("Subnet splitting is available for IPv4 only.");
	if (!/^\d{1,3}$/u.test(String(newPrefix))) throw new Error("Enter a new prefix length between 0 and 32.");
	const base = calculateSubnet(source) as Ipv4Subnet;
	const currentPrefix = prefix ?? 32;
	if (newPrefix <= currentPrefix) throw new Error(`The new prefix must be longer than /${currentPrefix}.`);
	if (newPrefix > 32) throw new Error("IPv4 prefixes run from 0 to 32.");
	const count = 2 ** (newPrefix - currentPrefix);
	if (count > 1_048_576) throw new Error("That split creates over a million subnets. Choose a longer base prefix.");
	const blockSize = 2 ** (32 - newPrefix);
	const network = ipv4ToNumber(base.network.split(".").map(Number));
	return {
		count,
		newPrefix,
		size: blockSize,
		listed: Array.from({ length: Math.min(count, maximumListedSubnets) }, (_, index) => {
			const start = network + index * blockSize;
			return {
				cidr: `${numberToIpv4(start)}/${newPrefix}`,
				range: `${numberToIpv4(start)} – ${numberToIpv4(start + blockSize - 1)}`,
			};
		}),
	};
};
