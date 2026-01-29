import { isProduction, SERVER_URL, CLIENT_URL } from "../config/env.js";

console.log("----- ENV DIAGNOSTICS -----");
console.log("Raw NODE_ENV:", process.env.NODE_ENV);
console.log("Raw RENDER:", process.env.RENDER);
console.log("Raw ONRENDER:", process.env.ONRENDER);
console.log("Calculated isProduction:", isProduction);
console.log("Calculated SERVER_URL:", SERVER_URL);
console.log("Calculated CLIENT_URL:", CLIENT_URL);
console.log("---------------------------");
