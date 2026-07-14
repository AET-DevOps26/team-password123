#!/usr/bin/env node
// Generates an RSA keypair for the RS256 JWT setup and prints .env-ready lines:
// auth-service signs with APP_JWT_PRIVATE_KEY, meals/analytics verify with
// APP_JWT_PUBLIC_KEY. Values are headerless single-line base64 of the DER
// encodings (PKCS#8 private / SPKI public) — the format every consumer
// (Spring services, docker compose, helm --set, GitHub secrets) accepts.
//
// Usage (from the repo root, after `cp .env.example .env`):
//   node scripts/gen-jwt-keys.mjs >> .env
//
// Never commit the generated private key.
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const base64Der = (key, type) => key.export({ type, format: 'der' }).toString('base64');

console.log(`APP_JWT_PRIVATE_KEY=${base64Der(privateKey, 'pkcs8')}`);
console.log(`APP_JWT_PUBLIC_KEY=${base64Der(publicKey, 'spki')}`);
