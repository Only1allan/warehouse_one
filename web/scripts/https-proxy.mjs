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
import net from "node:net";
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

const isWsl =
  fs.existsSync("/proc/version") &&
  fs.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");

/** The Windows Wi-Fi/Ethernet address, which is the one a phone can reach. */
function windowsLanAddress() {
  if (!isWsl) return null;
  try {
    const output = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|WSL' } | Select-Object -First 1 -ExpandProperty IPAddress",
      ],
      { encoding: "utf8", timeout: 8_000 },
    );
    return output.trim().split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

const windowsAddress = windowsLanAddress();
const phoneAddress = windowsAddress ?? addresses[0] ?? "localhost";

/** True when Windows already forwards this port to the current WSL address. */
function windowsForwardConfigured() {
  if (!isWsl || !addresses[0]) return false;
  try {
    const output = execFileSync("netsh.exe", ["interface", "portproxy", "show", "v4tov4"], {
      encoding: "utf8",
      timeout: 8_000,
    });
    return output.includes(String(LISTEN_PORT)) && output.includes(addresses[0]);
  } catch {
    return false;
  }
}

function appIsListening() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: TARGET_PORT });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1_000);
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}

if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
  fs.mkdirSync(certDir, { recursive: true });
  const san = [
    "DNS:localhost",
    "IP:127.0.0.1",
    ...(windowsAddress ? [`IP:${windowsAddress}`] : []),
    ...addresses.map((a) => `IP:${a}`),
  ].join(",");
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
  console.log(`  local  https://localhost:${LISTEN_PORT}`);
  console.log(`  phone  https://${phoneAddress}:${LISTEN_PORT}`);
  if (isWsl && windowsAddress) {
    if (windowsForwardConfigured()) {
      console.log(`  Windows port ${LISTEN_PORT} is forwarded to ${addresses[0]}.`);
    } else {
      console.log("");
      console.log(`WSL detected. Windows must forward port ${LISTEN_PORT} to ${addresses[0] ?? "this WSL machine"}.`);
      console.log("If the phone cannot connect, run this once in an Administrator PowerShell:");
      console.log("  powershell -ExecutionPolicy Bypass -File scripts\\windows-portproxy.ps1");
    }
  }
  void appIsListening().then((open) => {
    if (!open) {
      console.log("");
      console.log(`Warning: nothing is listening on port ${TARGET_PORT} yet.`);
      console.log('Start the app in another terminal with "npm run start".');
    }
  });
});
