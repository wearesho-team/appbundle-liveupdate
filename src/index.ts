import * as core from '@actions/core'
import {LiveUpdate} from "./live-update";
import {AxiosError} from "axios";
import * as console from "node:console";
import {updateVersion} from "./helpers/update-version";

export enum ModeEnum {
    ROLLOUT = 'rollout',
    DEACTIVATE = 'deactivate',
    ACTIVATE = 'activate',
    GET_ALL_CHANNELS_AND_VERSIONS = 'getAllChannelsAndVersions',
    GET_LATEST_VERSION = 'getLatestVersion',
}

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

    if (mode === ModeEnum.ROLLOUT) {
        const folderPath: string = core.getInput('path', {
          required: true
        })
        const channel: string = core.getInput('channel', {
          required: true
        })

        let latestVersion: string | null = null;

        try {
            latestVersion = await LiveUpdateInstance.getLatestVersion(channel);
        } catch (error) {
          if (error instanceof AxiosError) {
              console.warn(error.response?.data?.message)
          } else {
              console.warn(`Failed to fetch latest bundle: ${error.message}`);
          }
        }

        const newVersion:string = updateVersion(latestVersion);

        const uploadedVersion: string | null = await LiveUpdateInstance.uploadNewRelease({channel, version: newVersion, folderPath});

        if (uploadedVersion) {
            await LiveUpdateInstance.setBundleToUse({channel, version: newVersion, active: true});
        }

        return;
    }

    if (mode === ModeEnum.DEACTIVATE || mode === ModeEnum.ACTIVATE) {
        const isActivateMode: boolean = mode === ModeEnum.ACTIVATE;
        const channelInput: string = core.getInput('channel', {
          required: true
        });
        const versionInput: string = core.getInput('version');

        if (!versionInput) {
            const versionsFromServer = await LiveUpdateInstance.getAllVersions(channelInput);

            if (!versionsFromServer?.bundles?.length || !versionsFromServer?.bundles[0]?.bundle?.version) {
                core.setFailed('There are no versions for this channel. Please provide different channel');
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
        } else {
            await LiveUpdateInstance.setBundleToUse({channel: channelInput, version: versionInput, active: isActivateMode});
        }

        return;
    }

    if (mode === ModeEnum.GET_ALL_CHANNELS_AND_VERSIONS) {
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

    if (mode === ModeEnum.GET_LATEST_VERSION) {
        const channel: string = core.getInput('channel', {
            required: true
        })

        await LiveUpdateInstance.getLatestVersion(channel);

        return;
    }

    core.setFailed(`Invalid mode. Please provide a valid mode:${Object.values(ModeEnum).join(', ')}`);
  } catch (error) {
    core.setFailed(error.message)
  }
}

init();
