import type { ZxcvbnResult, zxcvbnAsync as ZxcvbnAsync } from "@zxcvbn-ts/core";

// The `@zxcvbn-ts/core` runtime and its language dictionaries together account for ~100 kB
// gzipped. They are only needed on /sign-up and /forgot-password, so the modules load lazily on
// the first `scorePassword` call. Sign-in stays out of this code path entirely.

let configurePromise: Promise<typeof ZxcvbnAsync> | null = null;

function loadScorer(): Promise<typeof ZxcvbnAsync> {
  configurePromise ??= (async () => {
    const [core, common, english] = await Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common"),
      import("@zxcvbn-ts/language-en"),
    ]);
    core.zxcvbnOptions.setOptions({
      translations: english.translations,
      graphs: common.adjacencyGraphs,
      dictionary: {
        ...common.dictionary,
        ...english.dictionary,
      },
    });
    return core.zxcvbnAsync;
  })();
  return configurePromise;
}

export async function scorePassword(
  password: string,
  userInputs: string[] = [],
): Promise<ZxcvbnResult> {
  const zxcvbnAsync = await loadScorer();
  return zxcvbnAsync(password, userInputs);
}
