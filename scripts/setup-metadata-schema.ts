/**
 * Create the painting custom metadata fields in ImageKit.
 *
 * Idempotent: existing fields are left alone, and select options are widened
 * to match lib/schema.ts if you have added a country or technique since.
 *
 *   npm run schema:setup
 */
import { CUSTOM_METADATA_SCHEMA } from "../lib/schema";
import { client, log } from "./_client";

async function main() {
  const ik = client();
  const existing = await ik.customMetadataFields.list();
  const byName = new Map(existing.map((f) => [f.name, f]));

  for (const field of CUSTOM_METADATA_SCHEMA) {
    const current = byName.get(field.name);

    if (!current) {
      await ik.customMetadataFields.create({
        name: field.name,
        label: field.label,
        schema: field.schema,
      });
      log(`created  ${field.name} (${field.schema.type})`);
      continue;
    }

    // Only select fields can meaningfully drift; widen their options.
    const wanted =
      "selectOptions" in field.schema ? field.schema.selectOptions : undefined;
    const have = current.schema.selectOptions as
      | Array<string | number | boolean>
      | undefined;

    if (wanted && have && wanted.some((o) => !have.includes(o))) {
      const merged = [...have, ...wanted.filter((o) => !have.includes(o))];
      await ik.customMetadataFields.update(current.id, {
        schema: { ...current.schema, selectOptions: merged },
      });
      log(`updated  ${field.name} — options now ${merged.length}`);
    } else {
      log(`ok       ${field.name}`);
    }
  }

  log("\nSchema ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
