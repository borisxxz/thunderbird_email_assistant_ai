import { DEFAULTS, FAILED_TAG, RETIRED_TAG_KEYS } from "./config.js";
import { getLanguage, t } from "./i18n.js";

// Resolves each tag definition to a real Thunderbird tag key:
//  1. an existing tag with the exact same name is reused (manual tags included),
//  2. otherwise a new tag is created with the definition's key,
//  3. if that key is taken by a differently-named tag, a "_ai" suffix is added.
// The defKey -> realKey mapping is persisted in storage as `tagKeys`.
//
// Migration must only run in the background page: options/summary each have
// their own bundle, and concurrent migrations with stale tag snapshots can
// overwrite each other's mapping. Other contexts ask the background to run it.
const MIGRATION_BUSY_KEY = 'tagMigrationBusy';

export async function ensureTagsExist() {
  let gotLock = false;
  try {
    // Cross-context guard: whoever holds the flag does the migration.
    const { [MIGRATION_BUSY_KEY]: busy } = await messenger.storage.local.get({ [MIGRATION_BUSY_KEY]: false });
    if (busy) return;
    await messenger.storage.local.set({ [MIGRATION_BUSY_KEY]: true });
    gotLock = true;

    let allTags;
    try {
      allTags = await messenger.messages.tags.list();
    } catch (error) {
      console.error("Email Assistant: Error listing tags:", error);
      return;
    }

    await getLanguage();
    const { customTags, tagKeys: oldMap } = await messenger.storage.local.get({
      customTags: DEFAULTS.customTags,
      tagKeys: {}
    });
    // The failed-marker tag is named in the current UI language.
    const tagDefs = [...customTags, { ...FAILED_TAG, name: t('failedTagName') }];
    const keyMap = {};

    for (const tagDef of tagDefs) {
      // One tag failing must not abort the migration of the others.
      try {
        // Reuse any existing tag with the exact same name — including our own
        // legacy "_ma_"-prefixed ones. Thunderbird rejects create() when the
        // name already exists, so excluding them would leave the tag unmapped
        // and its writes silently dropped.
        const sameName = allTags.find(existing => existing.tag === tagDef.name);
        if (sameName) {
          keyMap[tagDef.key] = sameName.key;
          continue;
        }
        // Exact key+name match: reuse as-is.
        const byKey = allTags.find(existing => existing.key === tagDef.key && existing.tag === tagDef.name);
        if (byKey) {
          keyMap[tagDef.key] = tagDef.key;
          continue;
        }
        // The failed tag's own label follows the UI language; rename legacy
        // variants of it. Never touch tags the user created under the same key.
        const keyOwner = allTags.find(existing => existing.key === tagDef.key);
        if (keyOwner && tagDef.key === FAILED_TAG.key &&
            /处理失败|Processing Failed/.test(keyOwner.tag) && messenger.messages.tags.update) {
          await messenger.messages.tags.update(tagDef.key, { tag: tagDef.name, color: tagDef.color });
          keyOwner.tag = tagDef.name;
          keyMap[tagDef.key] = tagDef.key;
          continue;
        }

        let key = tagDef.key;
        if (allTags.some(existing => existing.key === key)) {
          key = `${tagDef.key}_ai`;
        }
        await messenger.messages.tags.create(key, tagDef.name, tagDef.color);
        allTags.push({ key, tag: tagDef.name });
        keyMap[tagDef.key] = key;
      } catch (error) {
        console.error(`Email Assistant: Error ensuring tag ${tagDef.name}:`, error);
        if (oldMap[tagDef.key]) keyMap[tagDef.key] = oldMap[tagDef.key];
      }
    }

    // Merge with the latest stored map: a definition that failed this round
    // must not lose a working mapping written by another context.
    const { tagKeys: latestMap = {} } = await messenger.storage.local.get({ tagKeys: {} });
    await messenger.storage.local.set({ tagKeys: { ...latestMap, ...keyMap } });

    // NOTE: legacy and retired tag keys are deliberately NOT deleted. A key
    // like `_ma_tagged` may belong to a user or another extension, and
    // tags.delete() removes that tag from every message irreversibly. Leave
    // cleanup to the user if they no longer need those tags.
    void RETIRED_TAG_KEYS;
  } finally {
    if (gotLock) {
      await messenger.storage.local.set({ [MIGRATION_BUSY_KEY]: false }).catch(() => {});
    }
  }
}
