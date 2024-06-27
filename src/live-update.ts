import * as core from '@actions/core'
import FormData from 'form-data'
import { createReadStream } from 'node:fs'
import { isZipped, zipFolder } from './helpers/zip.js'
import axios, {AxiosError, AxiosInstance} from 'axios'
import {GetAllBranchesResponse, GetAllVersionsResponse} from "./types";
import {updateVersion} from "./helpers/update-version";


export class LiveUpdate {
    private api: AxiosInstance;

    constructor(baseUrl: string, privateKey?: string) {
        this.api = axios.create({
            baseURL: baseUrl || 'https://api.test.ncash.ng/v3/mobile/app-bundle/',
            withCredentials: false,
            headers: {
                "x-mobile-app-access-key": privateKey
            }
        });
    }

    getAllBranches = async ():Promise<GetAllBranchesResponse | undefined> => {
        try {
            const response = await this.api.get<GetAllBranchesResponse>('branches');
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                core.setFailed(error.response?.data?.message)
            } else {
                core.setFailed(`Failed to fetch latest bundle: ${error.message}`);
            }
        }
    }

    getLatestActiveVersion = async (channel: string): Promise<string | undefined> => {
        core.info(`Getting latest active bundle for channel: ${channel}...`)

        const response = await this.api.get(
            `latest?branch=${channel}`
        );
        const version = response.data?.bundle?.bundle?.version;

        core.info('Latest bundle successfully fetched');
        core.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
        core.setOutput('latestVersionOnServer', version);
        core.setOutput('nextVersionOnServer', updateVersion(version));

        return version;
    }

    getLatestVersion = async (channel: string): Promise<string | null> => {
        core.info(`Getting latest bundle for channel: ${channel}...`);

        const allVersions = await this.getAllVersions(channel);

        let version: string | null = null;
        if (allVersions?.bundles?.length && allVersions?.bundles?.length > 0) {
            version = allVersions.bundles[0].bundle?.version || null;
        }

        core.setOutput('latestVersionOnServer', version);
        core.setOutput('nextVersionOnServer', updateVersion(version));

        return version;
    }

    getAllVersions = async (channel: string): Promise<GetAllVersionsResponse | null> => {
        try {
            core.info(`Fetching all versions for channel:${channel}...`);
            const response = await this.api.get<GetAllVersionsResponse>(`versions?branch=${channel}`);
            core.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                core.setFailed(error.response?.data?.message)
            } else {
                core.setFailed(`Failed to fetch all versions for channel:${channel}: ${error.message}`);
            }
            return null;
        }
    }

    setBundleToUse = async ({channel, version, active}: {channel: string, version: string, active: boolean}) => {
        core.info(`Setting channel: ${channel} version: ${version} active: ${active} ...`)

        try {
            const response = await this.api.patch(
                `bundle?branch=${channel}&version=${version}`,
                {
                    "Bundle": {
                        "isActive": active
                    }
                }

            )
            core.info('Bundle successfully updated')
            core.info(`Response: ${JSON.stringify(response.data, null, 2)}`)
            core.info(`Bundle ID: ${response.data?.bundle?.bundle?.version}`);
        } catch (error) {
            if (error instanceof AxiosError) {
                core.setFailed(error.response?.data?.message)
            } else {
                core.setFailed(`Failed to update bundle: ${error.message}`);
            }
        }
    }

    uploadNewRelease = async ({channel, version, folderPath}: {channel: string, version: string, folderPath: string}): Promise<string | null> => {
        const formData = new FormData()

        if (isZipped(folderPath)) {
            formData.append('file', createReadStream(folderPath))
        } else {
            core.info('Zipping folder...')
            let zipBuffer;

            try {
                zipBuffer = await zipFolder(folderPath)
            } catch (error) {
                core.error('Zipping error');
                core.setFailed(`Zipping error: ${error.message}`);
                return null;
            }

            formData.append('Bundle[file]', zipBuffer, { filename: 'bundle.zip' })
        }

        formData.append('Bundle[branch]', channel)
        formData.append('Bundle[version]', version);



        core.info(`Uploading channel:${channel}, version:${version} ...`);

        try {
            const response = await this.api.post(
                `bundle`,
                formData
            );
            const uploadedVersion = response.data?.bundle?.bundle?.version;

            core.info('Bundle successfully created')
            core.info(`Response: ${JSON.stringify(response.data, null, 2)}`)
            if (uploadedVersion) {
                core.setOutput('UploadedVersion', uploadedVersion);
                return <string>uploadedVersion;
            }
        } catch (error) {
            core.setFailed(`Failed to create bundle: ${error}`);
        }

        return null;
    }
}
