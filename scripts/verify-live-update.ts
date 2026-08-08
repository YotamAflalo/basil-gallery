/**
 * Regression test for the core requirement: an edit reaches the live site
 * with no restart and no redeploy.
 *
 * Start the server first (`npm run build && npm run start`), then:
 *   npm run verify:live
 *
 * It briefly renames a real painting and puts the title back afterwards.
 *
 *   1. read a painting's title off the live /gallery page
 *   2. change it in ImageKit
 *   3. confirm /gallery still shows the OLD title  (the cache is real)
 *   4. deliver a signed file.updated webhook
 *   5. confirm /gallery now shows the NEW title    (revalidation works)
 *   6. put the original title back
 */
import crypto from "node:crypto";

import { client, listAll } from "./_client";

const BASE = "http://localhost:3000";
const SECRET = process.env.IMAGEKIT_WEBHOOK_SECRET!;

async function galleryHas(text: string): Promise<boolean> {
  const html = await fetch(`${BASE}/gallery`, { cache: "no-store" }).then((r) => r.text());
  return html.includes(text);
}

function signedHeaders(body: string) {
  const id = `msg_${crypto.randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // standardwebhooks: base64(HMAC-SHA256(secretBytes, `${id}.${ts}.${body}`)).
  // The SDK base64-encodes the raw secret before handing it over, so the key
  // bytes are the raw string itself.
  const signature = crypto
    .createHmac("sha256", Buffer.from(SECRET, "utf8"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  return {
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  };
}

async function main() {
  const ik = client();
  const files = await listAll(ik, "/paintings");
  const target = files.find((f) => String(f.filePath).includes("/Switzerland/"))!;
  const fileId = String(target.fileId);
  const original = (target.customMetadata as Record<string, unknown>)?.title;
  const marker = `LIVE-UPDATE-CHECK-${Date.now()}`;

  console.log(`target : ${target.filePath}`);
  console.log(`before : ${JSON.stringify(original)}\n`);

  // 2. change it in ImageKit, exactly as the admin save action does
  await ik.files.update(fileId, {
    customMetadata: {
      ...(target.customMetadata as Record<string, string | number | boolean>),
      title: marker,
    },
  });
  console.log("2. title changed in ImageKit");

  // 3. the site should NOT have noticed yet
  const leakedEarly = await galleryHas(marker);
  console.log(`3. /gallery shows new title before revalidation? ${leakedEarly}  (want false)`);

  // 4. signed webhook
  const body = JSON.stringify({
    id: `evt_${Date.now()}`,
    type: "file.updated",
    created_at: new Date().toISOString(),
    data: { fileId },
  });
  const res = await fetch(`${BASE}/api/webhooks/imagekit`, {
    method: "POST",
    headers: signedHeaders(body),
    body,
  });
  console.log(`4. webhook -> ${res.status} ${JSON.stringify(await res.json())}`);

  // 5. The contract is "live within the cache TTL", not "live on the next
  //    request": next start runs a pool of workers and the webhook only
  //    clears the one it landed in. Poll until the others age out.
  let liveNow = false;
  let attempts = 0;
  for (; attempts < 25; attempts++) {
    if (await galleryHas(marker)) {
      liveNow = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(
    `5. /gallery shows new title after revalidation? ${liveNow}   (want true, took ${attempts}s)`,
  );

  // also prove a forged signature is rejected
  const bad = await fetch(`${BASE}/api/webhooks/imagekit`, {
    method: "POST",
    headers: { ...signedHeaders(body), "webhook-signature": "v1,forged" },
    body,
  });
  console.log(`   forged signature -> ${bad.status}  (want 401)`);

  // 6. restore
  await ik.files.update(fileId, {
    customMetadata: {
      ...(target.customMetadata as Record<string, string | number | boolean>),
      ...(original ? { title: original as string } : {}),
    },
  });
  await fetch(`${BASE}/api/webhooks/imagekit`, {
    method: "POST",
    headers: signedHeaders(body),
    body,
  });
  console.log("\n6. original title restored");

  const pass = !leakedEarly && liveNow && bad.status === 401;
  console.log(`\n${pass ? "PASS" : "FAIL"} — edits reach the live site with no restart`);
  if (!pass) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
