export const updateVersion = (version: string | null) => {
    if (!version) {
        return '1';
    }

    if(version.includes(".")) {
        const [major, minor, patch] = version.split('.').map(Number);
        return `${major || 1}.${minor || 1}.${(patch || 0) + 1}`;
    }

    return `${parseInt(version) + 1}`;
}
