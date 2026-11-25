// React Native 0.88's prebuilt React.framework imports <react/...> headers that
// live outside the framework. CocoaPods also exposes them through
// Pods/Headers/Public/React-Core-prebuilt, and when clang resolves them via that
// path (e.g. @react-native-community/netinfo) the explicit-module precompile of
// `React` fails with -Werror=non-modular-include-in-framework-module.
// Allowing non-modular includes on pod targets downgrades that to a warning.
const { withPodfile } = require("expo/config-plugins");

const MARKER = "# tayylo: allow non-modular includes";

module.exports = function withNonModularIncludes(config) {
  return withPodfile(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes(MARKER)) {
      contents = contents.replace(
        /post_install do \|installer\|\n/,
        (m) =>
          `${m}    ${MARKER}\n` +
          `    installer.pods_project.targets.each do |t|\n` +
          `      t.build_configurations.each do |c|\n` +
          `        c.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'\n` +
          `      end\n` +
          `    end\n`,
      );
      cfg.modResults.contents = contents;
    }
    return cfg;
  });
};
