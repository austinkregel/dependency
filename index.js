const fs = require("fs");
const axios = require("axios");
const semver = require("semver");
const Table = require("cli-table");

const semverCompare = (a, b) => {
    const firstVersion = semver.clean(a);
    const secondVersion = semver.clean(b);

    if (semver.lt(firstVersion, secondVersion)) {
        return -1;
    }

    if (semver.gt(firstVersion, secondVersion)) {
        return 1;
    }

    return 0;
};

let maxPHPVersion = "1.0"; // Small max, so we can ensure it will always be overwritten
let minPHPVersion = "10000.0"; // Large min so we can do the same.
let packagesToUpdate = [];

class CheckComposerDependencies {
    async handle({ composerLocation }) {
        if (!composerLocation) {
            composerLocation = process.cwd();
        }

        const composerJson = composerLocation + "/composer.json";
        const composerLock = composerLocation + "/composer.lock";

        if (!fs.existsSync(composerJson)) {
            throw "There is no composer json file found at: " + composerJson;
        }

        if (!fs.existsSync(composerLock)) {
            throw "There is no composer.lock file found. Please install composer deps before running this command";
        }

        const composerJsonContents = JSON.parse(fs.readFileSync(composerJson, "UTF-8"));

        if (!composerJsonContents["require"]) {
            throw "There is no 'require'd items. Cant exactly do things...";
        }

        if (!composerJsonContents["require-dev"]) {
            throw "There is no 'require-dev'd items. Cant exactly do things...";
        }

        const requiredPackages = Object.assign(composerJsonContents["require"], composerJsonContents["require-dev"]);

        const composerLockContents = JSON.parse(fs.readFileSync(composerLock, "UTF-8"));
        const lockedPackages = composerLockContents["packages"].filter(pack => requiredPackages[pack.name]);

        await Promise.all(
            lockedPackages.map(async pack => {
                const currentVersionLocked = (semver.coerce(pack.version) || {}).version;
                const packageName = pack.name;

                if (!currentVersionLocked) {
                    console.log("No current lock version of package", packageName, currentVersionLocked);
                    // This will happen when a version is using `dev-master` or some non-tagged version.
                    return;
                }

                const packageRequirements = Object.assign(pack.require || {}, pack["require-dev"] || {});

                if (packageRequirements.php) {
                    // skip the php requirement.
                    this.setHighestPhpRequired(packageRequirements.php);
                    this.setLowestPhpRequired(packageRequirements.php);
                }

                try {
                    const {
                        data: {
                            packages: { [packageName]: versions }
                        }
                    } = await axios.get("https://repo.packagist.org/p/" + packageName + ".json");

                    // We should sort these versions by key.
                    const allVersionsOfPackage = Object.keys(versions)
                        .filter(version => !version.startsWith("dev"))
                        .filter(version => semver.coerce(version))
                        .map(originalVersion => {
                            const normalizedVersion = semver.coerce(originalVersion.replace("v", "")).version;

                            versions[normalizedVersion] = versions[originalVersion];

                            delete versions[originalVersion];

                            return normalizedVersion;
                        })
                        .sort(semverCompare);

                    const latestVersion = allVersionsOfPackage[allVersionsOfPackage.length - 1];

                    if (semver.lt(currentVersionLocked, latestVersion)) {
                        // We need to add it to our list of things to upgrade.
                        packagesToUpdate.push({
                            packageName,
                            currentVersionLocked,
                            latestVersion
                        });
                    }
                } catch (e) {
                    console.error(e, packageName, currentVersionLocked);
                }
            })
        );

        const tableInstance = new Table({
            head: ["Package Name", "Locked Version", "Latest version"]
        });

        packagesToUpdate.map(({ packageName, currentVersionLocked, latestVersion }) =>
            tableInstance.push([packageName, currentVersionLocked, latestVersion])
        );

        console.log(tableInstance.toString());
        console.log({
            minPHPVersion,
            maxPHPVersion
        });
    }

    setHighestPhpRequired(version) {
        if (semver.gt(semver.coerce(version), semver.coerce(maxPHPVersion))) {
            maxPHPVersion = semver.coerce(version).version;
        }
    }

    setLowestPhpRequired(version) {
        if (semver.lt(semver.coerce(version), semver.coerce(minPHPVersion))) {
            minPHPVersion = semver.coerce(version).version;
        }
    }
}

const check = new CheckComposerDependencies();
const composerLocation = process.argv[2];

check.handle({
    composerLocation // By default, if no args are provided we default to the current directory.
});
