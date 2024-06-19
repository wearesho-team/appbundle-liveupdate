import * as core from '@actions/core'
import {LiveUpdate} from "./live-update";
import {Bundle} from "./types";

const init = async () => {
  try {
    const mode: string = core.getInput('mode', {
      required: true
    });
    const baseUrl: string = core.getInput('baseUrl', {
      required: true
    });
    const accessToken: string = core.getInput('accessToken', {
      required: true
    });

    const LiveUpdateInstance: LiveUpdate = new LiveUpdate(baseUrl, accessToken);

    if (mode === 'rollout') {
        const folderPath: string = core.getInput('path', {
          required: true
        })
        const channel: string = core.getInput('channel', {
          required: true
        })

        let latestVersion: string | undefined = await LiveUpdateInstance.getLatestVersion(channel);

        if (!latestVersion) {
            latestVersion = '1';
        } else {
            if(latestVersion.includes(".")) {
              const [major, minor, patch] = latestVersion.split('.').map(Number);
              latestVersion = `${major}.${minor}.${patch + 1}`;
            } else {
              let version = parseInt(latestVersion);
              version++;
              latestVersion = `${version}`;
            }
        }

        await LiveUpdateInstance.uploadNewRelease({channel, version: latestVersion, folderPath});
        await LiveUpdateInstance.setBundleToUse({channel, version: latestVersion, active: true});
        return;
    }

    if (mode === 'deactivate' || mode === 'activate') {
        const isActivateMode: boolean = mode === 'activate';
        const channelInput: string = core.getInput('channel', {
          required: true
        });
        const versionInput: string = core.getInput('version');

        if (!versionInput) {
            const versionsFromServer = await LiveUpdateInstance.getAllVersions(channelInput);

            if (!versionsFromServer) {
                core.setFailed('Thera are no versions for this channel. Please provide different channel');
                return;
            }

            if (isActivateMode) {
                await LiveUpdateInstance.setBundleToUse({channel: channelInput, version: versionsFromServer.bundles[0].bundle.version, active: isActivateMode});
            } else {
                for (const item of versionsFromServer.bundles) {
                    await LiveUpdateInstance.setBundleToUse({channel: channelInput, version: item.bundle.version, active: isActivateMode});
                    // задержка 0.5с между запросами, чтобы уменьшить шанс словить лимиты на сервере
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            return;
        } else {
            await LiveUpdateInstance.setBundleToUse({channel: channelInput, version: versionInput, active: isActivateMode});
            return;
        }
    }

    if (mode === 'getAllChannelsAndVersions') {
        const getAllBranchesResponse = await LiveUpdateInstance.getAllBranches();

        if (!getAllBranchesResponse) {
            return;
        }

        console.log(`Branches:\n${JSON.stringify(getAllBranchesResponse.branches, null, 2)}\n\n`);
        for (const branchItem of getAllBranchesResponse.branches) {
            await LiveUpdateInstance.getAllVersions(branchItem.branch);
        }
        return;
    }

    core.setFailed('Invalid mode. Please provide a valid mode: rollout or rollback');
  } catch (error) {
    core.setFailed(error.message)
  }
}

init();
