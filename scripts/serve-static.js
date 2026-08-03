const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { resolveContainedPath } = require("./lib/path-safety");

const root = path.resolve(process.cwd());
const requestedPort = Number(process.argv[2] || process.env.PORT || 4173);
const port =
	Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4173;
const host = "127.0.0.1";

const MIME_TYPES = Object.freeze({
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".webp": "image/webp",
});

function send(response, statusCode, body, headers = {}) {
	response.writeHead(statusCode, {
		"Cache-Control": "no-store",
		"X-Content-Type-Options": "nosniff",
		...headers,
	});
	response.end(body);
}

function resolveRequestPath(requestURL) {
	const parsed = new URL(requestURL, `http://${host}:${port}`);
	const decoded = decodeURIComponent(parsed.pathname);
	const relativePath = decoded === "/" ? "/index.html" : decoded;
	try {
		return resolveContainedPath(root, relativePath.slice(1), "request path");
	} catch (error) {
		return null;
	}
}

function serveFile(request, response, filePath) {
	fs.stat(filePath, (statError, stats) => {
		if (statError) {
			send(response, statError.code === "ENOENT" ? 404 : 500, "Not found");
			return;
		}

		const resolvedFile = stats.isDirectory()
			? path.join(filePath, "index.html")
			: filePath;

		let safeFile;
		try {
			safeFile = resolveContainedPath(
				root,
				path.relative(root, resolvedFile),
				"served file",
			);
		} catch (error) {
			send(response, 403, "Forbidden");
			return;
		}

		fs.readFile(safeFile, (readError, content) => {
			if (readError) {
				send(response, readError.code === "ENOENT" ? 404 : 500, "Not found");
				return;
			}

			const contentType =
				MIME_TYPES[path.extname(resolvedFile).toLowerCase()] ||
				"application/octet-stream";
			response.writeHead(200, {
				"Cache-Control": "no-store",
				"Content-Type": contentType,
				"Content-Length": content.length,
				"X-Content-Type-Options": "nosniff",
			});
			response.end(request.method === "HEAD" ? undefined : content);
		});
	});
}

const server = http.createServer((request, response) => {
	if (!["GET", "HEAD"].includes(request.method || "")) {
		send(response, 405, "Method not allowed", { Allow: "GET, HEAD" });
		return;
	}

	let filePath;
	try {
		filePath = resolveRequestPath(request.url || "/");
	} catch (error) {
		send(response, 400, "Bad request");
		return;
	}

	if (!filePath) {
		send(response, 403, "Forbidden");
		return;
	}
	serveFile(request, response, filePath);
});

server.listen(port, host, () => {
	console.log(`Needles static server listening on http://${host}:${port}`);
});

function shutdown() {
	server.close((error) => {
		process.exit(error ? 1 : 0);
	});
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
