"use client";

import { useMemo, useState } from "react";
import { calculateSubnet, splitIntoSubnets, type Ipv4Subnet } from "@/features/developer-tools/subnet-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, fieldClassName, hintClassName, labelClassName } from "@/features/developer-tools/tool-ui";

export const SubnetTool = () => {
	const [source, setSource] = useState("192.168.1.10/24");
	const [splitPrefix, setSplitPrefix] = useState("26");
	const subnet = useMemo(() => {
		try {
			return { result: calculateSubnet(source), error: "" };
		} catch (error) {
			return { result: null, error: error instanceof Error ? error.message : "Could not read this address." };
		}
	}, [source]);
	const split = useMemo(() => {
		if (!subnet.result) return { listing: "", error: "" };
		try {
			const result = splitIntoSubnets(source, Number(splitPrefix));
			const listing = [
				`${result.count.toLocaleString("en-US")} × /${result.newPrefix} subnets (${result.size.toLocaleString("en-US")} addresses each)`,
				"",
				...result.listed.map((item) => `${item.cidr.padEnd(20, " ")} ${item.range}`),
				...(result.count > result.listed.length ? [`… ${(result.count - result.listed.length).toLocaleString("en-US")} more`] : []),
			].join("\n");
			return { listing, error: "" };
		} catch (error) {
			return { listing: "", error: error instanceof Error ? error.message : "Could not split this block." };
		}
	}, [source, splitPrefix, subnet.result]);

	const ipv4 = subnet.result?.version === "IPv4" ? (subnet.result as Ipv4Subnet) : null;
	const ipv6 = subnet.result?.version === "IPv6" ? subnet.result : null;
	return (
		<ToolPanel>
			<label className={labelClassName} htmlFor="subnet-input">
				IP address or CIDR block
				<input
					className={`${fieldClassName} font-mono`}
					id="subnet-input"
					value={source}
					onChange={(event) => setSource(event.target.value)}
					placeholder="10.0.0.0/8 or 2001:db8::/32"
					spellCheck={false}
				/>
			</label>
			<ErrorNote message={subnet.error} />
			{subnet.result && (
				<>
					<StatGrid
						items={
							ipv4
								? [
										{ label: "Network", value: ipv4.network },
										{ label: "Broadcast", value: ipv4.broadcast },
										{ label: "Netmask", value: ipv4.netmask },
										{ label: "Wildcard", value: ipv4.wildcard },
										{ label: "First host", value: ipv4.firstHost },
										{ label: "Last host", value: ipv4.lastHost },
										{ label: "Usable hosts", value: ipv4.usableHosts },
										{ label: "Total addresses", value: ipv4.totalAddresses },
										{ label: "Scope", value: ipv4.scope },
										{ label: "Address class", value: ipv4.addressClass },
										{ label: "Binary network", value: ipv4.binaryNetwork },
										{ label: "Reverse DNS", value: ipv4.reverseDns },
									]
								: ipv6
									? [
											{ label: "Network", value: `${ipv6.network}/${ipv6.prefix}` },
											{ label: "Expanded address", value: ipv6.expanded },
											{ label: "Total addresses", value: ipv6.totalAddresses },
											{ label: "Scope", value: ipv6.scope },
										]
									: []
						}
					/>
					{ipv4 && (
						<div className="flex flex-col gap-3 border-t border-line pt-[18px]">
							<div className="flex flex-wrap items-end gap-3">
								<label className={`${labelClassName} w-40`} htmlFor="subnet-split">
									Split into /prefix
									<input
										className={fieldClassName}
										id="subnet-split"
										value={splitPrefix}
										onChange={(event) => setSplitPrefix(event.target.value)}
										inputMode="numeric"
									/>
								</label>
								<p className={`${hintClassName} max-w-[420px] pb-2`}>Lists up to 64 subnets; the count reflects the whole block.</p>
							</div>
							<ErrorNote message={split.error} />
							{!split.error && <ResultBlock title="Subnet split" value={split.listing} rows={10} />}
						</div>
					)}
				</>
			)}
			<p className={hintClassName}>
				IPv4 results include network, broadcast, mask, wildcard, usable range, and reverse-DNS zone. IPv6 results show the compressed network,
				expanded address, and address count.
			</p>
		</ToolPanel>
	);
};
