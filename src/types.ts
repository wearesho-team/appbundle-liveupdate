export type GetAllBranchesResponse = {
    "branches": Array<{ "branch": string, "count": number }>
};

export type Bundle = {
    branch: string;
    bundle: {
        version: string;
        url: string;
        hash: string;
    };
    signature: string;
    isActive: boolean;
}
export type BundleResponse = {
    bundle: Bundle;
};

export type GetAllVersionsResponse = {
    bundles: Array<Bundle>;
};
