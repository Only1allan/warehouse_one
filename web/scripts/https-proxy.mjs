/**
 * Serves the app over HTTPS on your local network, so a phone's camera and microphone work.
 * Browsers only allow the microphone on https:// pages (or on localhost).
 *
 *   npm run start            # the app on port 3000
 *   npm run phone            # https://<this-computer's-ip>:3443
 *
 * The certificate is self-signed and made on this computer; the phone will warn about it
 * once. No internet is needed at any point.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";

const TARGET_PORT = Number(process.env.APP_PORT ?? 3000);
const LISTEN_PORT = Number(process.env.HTTPS_PORT ?? 3443);
const certDir = path.join(process.cwd(), "data", "certs");
const keyFile = path.join(certDir, "key.pem");
const certFile = path.join(certDir, "cert.pem");

const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a.address);

if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
  fs.mkdirSync(certDir, { recursive: true });
  const san = ["DNS:localhost", "IP:127.0.0.1", ...addresses.map((a) => `IP:${a}`)].join(",");
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "365",
    "-keyout", keyFile, "-out", certFile,
    "-subj", "/CN=Warehouse Copilot (local)",
    "-addext", `subjectAltName=${san}`,
  ], { stdio: "ignore" });
  console.log("Created a self-signed certificate in data/certs");
}

const server = https.createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }, (req, res) => {
  const upstream = http.request(
    { host: "127.0.0.1", port: TARGET_PORT, path: req.url, method: req.method, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`The app is not running on port ${TARGET_PORT}. Start it with "npm run start".`);
  });
  req.pipe(upstream);
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`HTTPS proxy to http://localhost:${TARGET_PORT}`);
  for (const a of ["localhost", ...addresses]) console.log(`  open  https://${a}:${LISTEN_PORT}`);
});
