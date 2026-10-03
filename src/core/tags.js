import { DEFAULTS, FAILED_TAG, RETIRED_TAG_KEYS } from "./config.js";

// Resolves each tag definition to a real Thunderbird tag key:
//  1. an existing tag with the exact same name is reused (manual tags included),
//  2. otherwise a new tag is created with the definition's key,
//  3. if that key is taken by a differently-named tag, a "_ai" suffix is added.
// The defKey -> realKey mapping is persisted in storage as `tagKeys`.
export async function ensureTagsExist() {
  let allTags;
  try {
    allTags = await messenger.messages.tags.list();
  } catch (error) {
    console.error("Email Assistant: Error listing tags:", error);
    return;
  }

  const { customTags, tagKeys: oldMap } = await messenger.storage.local.get({
    customTags: DEFAULTS.customTags,
    tagKeys: {}
  });
  const tagDefs = [...customTags, FAILED_TAG];
  const keyMap = {};
  const legacyPrefix = "_ma_";

  for (const tagDef of tagDefs) {
    // One tag failing must not abort the migration of the others.
    try {
      // Reuse a tag the user created manually — but never our own legacy
      // "_ma_"-prefixed ones; those are rebuilt and removed instead.
      const sameName = allTags.find(existing =>
        existing.tag === tagDef.name && !existing.key.startsWith(legacyPrefix));
      if (sameName) {
        keyMap[tagDef.key] = sameName.key;
        continue;
      }

      let key = tagDef.key;
      if (allTags.some(existing => existing.key === key)) {
        key = `${tagDef.key}_ai`;
      }
      await messenger.messages.tags.create(key, tagDef.name, tagDef.color);
      allTags.push({ key, tag: tagDef.name });
      keyMap[tagDef.key] = key;

      // Remove the legacy prefixed variant of this tag, if present.
      const legacyKey = legacyPrefix + tagDef.key;
      if (legacyKey !== key && allTags.some(existing => existing.key === legacyKey)) {
        try {
          await messenger.messages.tags.delete(legacyKey);
          allTags = allTags.filter(existing => existing.key !== legacyKey);
          console.log(`Email Assistant: Removed legacy tag: ${legacyKey}`);
        } catch (error) {
          console.error(`Email Assistant: Error removing legacy tag ${legacyKey}:`, error);
        }
      }
    } catch (error) {
      console.error(`Email Assistant: Error ensuring tag ${tagDef.name}:`, error);
      if (oldMap[tagDef.key]) keyMap[tagDef.key] = oldMap[tagDef.key];
    }
  }

  await messenger.storage.local.set({ tagKeys: keyMap });

  // Remove tags this add-on no longer uses at all.
  if (messenger.messages.tags.delete) {
    for (const key of RETIRED_TAG_KEYS) {
      if (allTags.some(existing => existing.key === key)) {
        try {
          await messenger.messages.tags.delete(key);
          console.log(`Email Assistant: Removed retired tag: ${key}`);
        } catch (error) {
          console.error(`Email Assistant: Error removing retired tag ${key}:`, error);
        }
      }
    }
  }
}
