import { DEFAULTS, HARDCODED_TAGS, TAG_KEY_PREFIX, RETIRED_TAG_KEYS } from "./config.js";

// Tag labels created by earlier versions carried an "A: " prefix; migrate them.
const LEGACY_NAME_PREFIX = "A: ";

export async function ensureTagsExist() {
  let allTags;
  try {
    allTags = await messenger.messages.tags.list();
  } catch (error) {
    console.error("Email Assistant: Error listing tags:", error);
    return;
  }

  const { customTags } = await messenger.storage.local.get({ customTags: DEFAULTS.customTags });
  const tagsToEnsure = [...Object.values(HARDCODED_TAGS), ...customTags];

  for (const tagToCreate of tagsToEnsure) {
    // One tag failing must not abort the migration of the others.
    try {
      const key = TAG_KEY_PREFIX + tagToCreate.key;
      const byKey = allTags.find(existingTag => existingTag.key === key);

      if (byKey) {
        if (byKey.tag !== tagToCreate.name && messenger.messages.tags.update) {
          console.log(`Email Assistant: Updating tag label: ${byKey.tag} -> ${tagToCreate.name}`);
          await messenger.messages.tags.update(key, { tag: tagToCreate.name, color: tagToCreate.color });
        }
      } else {
        // Only skip creation when a differently-keyed tag already uses this name
        // (or its legacy "A: " variant) — creating a duplicate name is confusing.
        const nameTaken = allTags.some(existingTag =>
          existingTag.tag === tagToCreate.name ||
          existingTag.tag === LEGACY_NAME_PREFIX + tagToCreate.name
        );
        if (!nameTaken) {
          console.log(`Email Assistant: Creating new tag: ${tagToCreate.name}`);
          await messenger.messages.tags.create(key, tagToCreate.name, tagToCreate.color);
        }
      }
    } catch (error) {
      console.error(`Email Assistant: Error ensuring tag ${tagToCreate.name}:`, error);
    }
  }

  // Remove tags this add-on no longer applies — but never ones the user kept.
  if (messenger.messages.tags.delete) {
    const activeKeys = new Set(tagsToEnsure.map(tag => TAG_KEY_PREFIX + tag.key));
    for (const key of RETIRED_TAG_KEYS) {
      if (activeKeys.has(key)) continue;
      if (allTags.some(existingTag => existingTag.key === key)) {
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
