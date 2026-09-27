// /api/v1/products/media — product files (0106), at the route.
//
// Uploads land only under the caller's own folder, and a delete only ever
// removes a file from that folder, whatever url it is handed.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { BUYER_ID, fake, resetFake } from "../../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake client must be installed before the route loads.
const { DELETE, POST } = require("./route") as typeof import("./route");

const ENDPOINT = "https://sourcebd.net/api/v1/products/media";
const PUBLIC = "https://supabase.invalid/storage/v1/object/public/product-media/";
const OTHER_BUYER = "7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a";

function upload(parts: { file?: File; kind?: string }) {
  const form = new FormData();
  if (parts.file) form.set("file", parts.file);
  if (parts.kind !== undefined) form.set("kind", parts.kind);
  return POST(new Request(ENDPOINT, { method: "POST", body: form }));
}

const png = (bytes = 8) => new File([new Uint8Array(bytes)], "front.png", { type: "image/png" });
const pdf = () => new File([new Uint8Array(8)], "tech-pack.pdf", { type: "application/pdf" });

const remove = (body: unknown) =>
  DELETE(
    new Request(ENDPOINT, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

async function refusedUpload(parts: { file?: File; kind?: string }, pattern: RegExp): Promise<void> {
  const res = await upload(parts);
  assert.equal(res.status, 400);
  assert.match(((await res.json()) as { error: string }).error, pattern);
  assert.equal(fake.uploads.length, 0, "a refused file was still uploaded");
}

beforeEach(resetFake);

describe("/api/v1/products/media without a session", () => {
  it("answers 401 to an upload and a delete, and touches no file", async () => {
    fake.userId = null;
    assert.equal((await upload({ file: png(), kind: "image" })).status, 401);
    assert.equal((await remove({ url: `${PUBLIC}${BUYER_ID}/1-abc.png` })).status, 401);
    assert.equal(fake.uploads.length + fake.removed.length, 0);
  });
});

describe("POST /api/v1/products/media", () => {
  it("uploads an image into the caller's own folder and returns its url and kind", async () => {
    const res = await upload({ file: png(), kind: "image" });
    assert.equal(res.status, 200);
    const [up] = fake.uploads;
    assert.equal(up?.bucket, "product-media");
    assert.match(up?.path ?? "", new RegExp(`^${BUYER_ID}/\\d+-[0-9a-f]{8}\\.png$`));
    assert.deepEqual(await res.json(), { url: `${PUBLIC}${up?.path}`, kind: "image" });
  });

  it("takes a PDF as a tech pack", async () => {
    const res = await upload({ file: pdf(), kind: "tech_pack" });
    assert.equal(res.status, 200);
    assert.match(fake.uploads[0]?.path ?? "", /\.pdf$/);
  });

  it("refuses each bad upload with a sentence", async () => {
    await refusedUpload({ file: png() }, /image, video, model or tech_pack/);
    await refusedUpload({ file: png(), kind: "audio" }, /image, video, model or tech_pack/);
    await refusedUpload({ kind: "image" }, /Choose a file/);
    await refusedUpload({ file: png(0), kind: "image" }, /empty/);
    await refusedUpload({ file: png(10 * 1024 * 1024 + 1), kind: "image" }, /10 MB/);
    await refusedUpload({ file: new File(["hi"], "a.txt", { type: "text/plain" }), kind: "image" }, /PNG, JPEG, WebP or GIF image, or a PDF/);
    await refusedUpload({ file: pdf(), kind: "image" }, /An image must be/);
  });

  it("answers 400, not 200, when storage refuses", async () => {
    fake.uploadError = { message: "mime type not supported" };
    const res = await upload({ file: png(), kind: "image" });
    assert.equal(res.status, 400);
  });
});

describe("DELETE /api/v1/products/media", () => {
  it("removes a file from the caller's own folder", async () => {
    const res = await remove({ url: `${PUBLIC}${BUYER_ID}/1727400000000-a1b2c3d4.png` });
    assert.equal(res.status, 200);
    assert.deepEqual(fake.removed, [{ bucket: "product-media", paths: [`${BUYER_ID}/1727400000000-a1b2c3d4.png`] }]);
  });

  it("will not remove another buyer's file, or climb out of the folder", async () => {
    for (const url of [
      `${PUBLIC}${OTHER_BUYER}/1-a.png`,
      `${PUBLIC}${BUYER_ID}/../${OTHER_BUYER}/1-a.png`,
      `${PUBLIC}${BUYER_ID}%2F..%2F${OTHER_BUYER}%2F1-a.png`,
      `${PUBLIC}${BUYER_ID}/sub/1-a.png`,
      `${PUBLIC}${BUYER_ID}/`,
    ]) {
      const res = await remove({ url });
      assert.equal(res.status, 403, url);
    }
    assert.equal(fake.removed.length, 0);
  });

  it("refuses a url outside the bucket, or none at all", async () => {
    for (const body of [
      { url: `https://supabase.invalid/storage/v1/object/public/avatars/${BUYER_ID}/1.png` },
      { url: `https://evil.example/storage/v1/object/public/product-media/${BUYER_ID}/1.png` },
      {},
      { url: 42 },
    ]) {
      assert.equal((await remove(body)).status, 400, JSON.stringify(body));
    }
    assert.equal(fake.removed.length, 0);
  });
});
