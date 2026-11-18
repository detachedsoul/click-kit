export type StatusCategory = "1xx" | "2xx" | "3xx" | "4xx" | "5xx";

export type HttpStatus = { code: number; name: string; category: StatusCategory; description: string };

const status = (code: number, name: string, description: string): HttpStatus => ({
	code,
	name,
	category: `${String(code)[0]}xx` as StatusCategory,
	description,
});

export const httpStatuses: HttpStatus[] = [
	status(100, "Continue", "The server received the request headers and the client should send the body."),
	status(101, "Switching Protocols", "The server is switching protocols as requested, commonly to WebSocket."),
	status(102, "Processing", "The server has received the request but has not finished processing it yet."),
	status(103, "Early Hints", "Sends preliminary headers so the client can preload resources before the final response."),
	status(200, "OK", "The request succeeded and the response body carries the result."),
	status(201, "Created", "A new resource was created; the Location header usually points to it."),
	status(202, "Accepted", "The request was accepted for processing, but processing is not complete."),
	status(203, "Non-Authoritative Information", "The response came from a transforming proxy rather than the origin server."),
	status(204, "No Content", "The request succeeded and there is intentionally no response body."),
	status(205, "Reset Content", "The client should reset the document view that sent the request."),
	status(206, "Partial Content", "A range request succeeded and the body contains only the requested bytes."),
	status(207, "Multi-Status", "The response body contains status information for several independent operations."),
	status(208, "Already Reported", "Members of a WebDAV binding were already reported in an earlier response."),
	status(226, "IM Used", "The server applied instance manipulations to the resource before responding."),
	status(300, "Multiple Choices", "Several representations exist and the client must choose one."),
	status(301, "Moved Permanently", "The resource now lives at a new URL and clients should update their links."),
	status(302, "Found", "The resource is temporarily at another URL, usually for redirects after a form post."),
	status(303, "See Other", "Fetch the result from another URL, typically with a GET after a POST."),
	status(304, "Not Modified", "The client's cached copy is still valid, so no body is returned."),
	status(307, "Temporary Redirect", "Like 302, but the client must keep the original method and body."),
	status(308, "Permanent Redirect", "Like 301, but the client must keep the original method and body."),
	status(400, "Bad Request", "The request could not be understood because of malformed syntax or invalid data."),
	status(401, "Unauthorized", "Authentication is required, or the supplied credentials failed."),
	status(402, "Payment Required", "Reserved for future use, sometimes used for paid APIs."),
	status(403, "Forbidden", "The server understood the request but refuses to authorise it."),
	status(404, "Not Found", "No resource matches the requested URL."),
	status(405, "Method Not Allowed", "The URL exists but does not support this HTTP method."),
	status(406, "Not Acceptable", "No representation matching the Accept headers is available."),
	status(407, "Proxy Authentication Required", "The client must authenticate with the proxy first."),
	status(408, "Request Timeout", "The server timed out waiting for the request to finish."),
	status(409, "Conflict", "The request conflicts with the current state of the resource."),
	status(410, "Gone", "The resource existed but has been permanently removed."),
	status(411, "Length Required", "The request must include a valid Content-Length header."),
	status(412, "Precondition Failed", "A conditional header such as If-Match was not satisfied."),
	status(413, "Content Too Large", "The request body exceeds the limits the server accepts."),
	status(414, "URI Too Long", "The requested URL is longer than the server is willing to interpret."),
	status(415, "Unsupported Media Type", "The request body format is not supported by the resource."),
	status(416, "Range Not Satisfiable", "The requested byte range cannot be satisfied."),
	status(417, "Expectation Failed", "The Expect request header cannot be met by the server."),
	status(418, "I'm a Teapot", "An April Fools' status kept in the spec; short and stout servers only."),
	status(421, "Misdirected Request", "The request reached a server that cannot produce a response for this host."),
	status(422, "Unprocessable Content", "The request is well formed but contains semantic errors, common in validation APIs."),
	status(423, "Locked", "The resource is locked by a WebDAV lock."),
	status(424, "Failed Dependency", "The request failed because an earlier request it depended on failed."),
	status(425, "Too Early", "The server is unwilling to risk processing a request that may be replayed."),
	status(426, "Upgrade Required", "The client must switch protocols, often to a newer TLS version."),
	status(428, "Precondition Required", "The server requires the request to be conditional to avoid lost updates."),
	status(429, "Too Many Requests", "The client is rate limited; check Retry-After for when to try again."),
	status(431, "Request Header Fields Too Large", "Headers exceed the size the server accepts."),
	status(451, "Unavailable For Legal Reasons", "The resource is blocked for legal or policy reasons."),
	status(500, "Internal Server Error", "The server hit an unexpected condition and could not complete the request."),
	status(501, "Not Implemented", "The server does not support the functionality required for the request."),
	status(502, "Bad Gateway", "A proxy or gateway received an invalid response from an upstream server."),
	status(503, "Service Unavailable", "The server is overloaded or down for maintenance; retry later."),
	status(504, "Gateway Timeout", "An upstream server did not respond in time to a proxy or gateway."),
	status(505, "HTTP Version Not Supported", "The server does not support the HTTP version used in the request."),
	status(506, "Variant Also Negotiates", "Content negotiation for the resource is misconfigured."),
	status(507, "Insufficient Storage", "The server cannot store the representation needed to complete the request."),
	status(508, "Loop Detected", "The server detected an infinite loop while processing a WebDAV request."),
	status(510, "Not Extended", "Further extensions to the request are required for the server to fulfil it."),
	status(511, "Network Authentication Required", "The client must authenticate to gain network access, as on a captive portal."),
];

export const statusCategories: { id: StatusCategory | "all"; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "1xx", label: "1xx Informational" },
	{ id: "2xx", label: "2xx Success" },
	{ id: "3xx", label: "3xx Redirect" },
	{ id: "4xx", label: "4xx Client error" },
	{ id: "5xx", label: "5xx Server error" },
];

export const filterStatuses = (query: string, category: StatusCategory | "all" = "all") => {
	const needle = query.trim().toLowerCase();
	return httpStatuses.filter((item) => {
		if (category !== "all" && item.category !== category) return false;
		if (!needle) return true;
		return String(item.code).includes(needle) || item.name.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle);
	});
};
